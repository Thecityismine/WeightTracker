import { shiftDateKey, toDateKey, type DateKey } from "./dates";
import type { DailyTotals, MacroTargets, WeightLog } from "@/types";

/**
 * Weekly analysis.
 *
 * Everything here is pure so it can be tested without Firestore. The Progress
 * screen renders these numbers; it never derives its own.
 *
 * The governing idea: a single day means almost nothing. Daily weight swings
 * by pounds on water and sodium alone, and one low-calorie day is noise. The
 * weekly average is the smallest unit that carries a signal.
 */

export type WeekSummary = {
  weekStart: DateKey;
  /** Days in this week with at least one food logged. */
  loggedDays: number;
  avgCalories: number | null;
  avgProtein: number | null;
  avgFat: number | null;
  calorieTargetDays: number;
  proteinTargetDays: number;
  startWeight: number | null;
  endWeight: number | null;
  avgWeight: number | null;
  /** Change in weekly AVERAGE weight against the previous week. */
  weightChange: number | null;
};

/** Sunday of the week containing `key`. */
export function weekStartKey(key: DateKey): DateKey {
  const d = new Date(`${key}T00:00:00`);
  return toDateKey(new Date(d.getTime() - d.getDay() * 86_400_000));
}

/**
 * Group logged days and weigh-ins into weeks, most recent last.
 *
 * `weightChange` compares weekly *averages* rather than first-to-last
 * readings — comparing two single mornings mostly measures hydration.
 */
export function buildWeeks(
  totals: DailyTotals[],
  weights: WeightLog[],
  targets: MacroTargets,
): WeekSummary[] {
  const byWeek = new Map<
    DateKey,
    { totals: DailyTotals[]; weights: WeightLog[] }
  >();

  const bucket = (key: DateKey) => {
    const ws = weekStartKey(key);
    if (!byWeek.has(ws)) byWeek.set(ws, { totals: [], weights: [] });
    return byWeek.get(ws)!;
  };

  for (const t of totals) {
    if (t.entryCount > 0) bucket(t.date).totals.push(t);
  }
  for (const w of weights) {
    bucket(w.date).weights.push(w);
  }

  const summaries = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, { totals: ts, weights: ws }]) => {
      ws.sort((a, b) => a.date.localeCompare(b.date));

      const avg = (nums: number[]) =>
        nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

      return {
        weekStart,
        loggedDays: ts.length,
        avgCalories: avg(ts.map((t) => t.calories)),
        avgProtein: avg(ts.map((t) => t.protein)),
        avgFat: avg(ts.map((t) => t.fat)),
        calorieTargetDays: ts.filter((t) => t.calories >= targets.calories)
          .length,
        proteinTargetDays: ts.filter((t) => t.protein >= targets.protein)
          .length,
        startWeight: ws.length ? ws[0].weight : null,
        endWeight: ws.length ? ws[ws.length - 1].weight : null,
        avgWeight: avg(ws.map((w) => w.weight)),
        weightChange: null as number | null,
      };
    });

  // Week-over-week change, computed once the weeks are in order.
  for (let i = 1; i < summaries.length; i++) {
    const prev = summaries[i - 1].avgWeight;
    const curr = summaries[i].avgWeight;
    summaries[i].weightChange =
      prev != null && curr != null ? curr - prev : null;
  }

  return summaries;
}

export type Progress = {
  startingWeight: number;
  goalWeight: number;
  currentAverage: number | null;
  gained: number;
  remaining: number;
  /** 0–1, clamped. */
  fraction: number;
  reached: boolean;
};

export function computeProgress(
  startingWeight: number,
  goalWeight: number,
  currentAverage: number | null,
): Progress {
  const current = currentAverage ?? startingWeight;
  const span = goalWeight - startingWeight;
  const gained = current - startingWeight;
  const remaining = goalWeight - current;

  const fraction =
    span === 0 ? 1 : Math.max(0, Math.min(1, gained / span));

  return {
    startingWeight,
    goalWeight,
    currentAverage,
    gained,
    remaining,
    fraction,
    reached: span > 0 ? current >= goalWeight : current <= goalWeight,
  };
}

/**
 * Average weekly gain across the weeks that actually have two weigh-ins to
 * compare. Returns null when there is not yet enough history to say.
 */
export function averageWeeklyGain(weeks: WeekSummary[]): number | null {
  const changes = weeks
    .map((w) => w.weightChange)
    .filter((c): c is number => c != null);
  if (changes.length === 0) return null;
  return changes.reduce((a, b) => a + b, 0) / changes.length;
}

/** Projected date of reaching the goal at the current rate. */
export function estimateGoalDate(
  remaining: number,
  weeklyGain: number | null,
  from: DateKey,
): DateKey | null {
  // No rate, or moving the wrong way — refuse to project rather than
  // print a confident date that means nothing.
  if (weeklyGain == null || weeklyGain <= 0.01) return null;
  if (remaining <= 0) return from;

  const weeks = remaining / weeklyGain;
  if (!Number.isFinite(weeks) || weeks > 260) return null;

  return shiftDateKey(from, Math.ceil(weeks * 7));
}

export type Recommendation = {
  stalled: boolean;
  /**
   * Distinguishes "nothing is happening" from "not enough data to tell".
   * Both leave `stalled` false, but they are not the same statement, and
   * showing a success colour for the second one implies a verdict that has
   * not been reached.
   */
  verdict: "insufficient" | "on_track" | "stalled";
  /** Suggested change to the daily calorie target. */
  suggestedCalorieIncrease: number;
  message: string;
};

/**
 * Stall detection.
 *
 * Two *complete* weeks without meaningful gain is the trigger — one flat week
 * is well within normal fluctuation. The app only ever recommends; changing a
 * target stays a decision the user makes.
 */
export function detectStall(
  weeks: WeekSummary[],
  currentCalorieTarget: number,
): Recommendation {
  const comparable = weeks.filter((w) => w.weightChange != null);
  const lastTwo = comparable.slice(-2);

  if (lastTwo.length < 2) {
    return {
      stalled: false,
      verdict: "insufficient",
      suggestedCalorieIncrease: 0,
      message:
        "Not enough history yet. Two full weeks of weigh-ins will show whether the trend is real.",
    };
  }

  const total = lastTwo.reduce((sum, w) => sum + (w.weightChange ?? 0), 0);

  if (total >= 0.1) {
    return {
      stalled: false,
      verdict: "on_track",
      suggestedCalorieIncrease: 0,
      message: `Average weight is up ${total.toFixed(1)} lb over the last two weeks. Keep the calorie target where it is.`,
    };
  }

  return {
    stalled: true,
    verdict: "stalled",
    suggestedCalorieIncrease: 150,
    message: `Average weight has not moved in two weeks. Consider raising the daily calorie target to ${(
      currentCalorieTarget + 150
    ).toLocaleString()}.`,
  };
}

/** Plain-language read on the most recent week. */
export function interpretWeek(
  week: WeekSummary | null,
  targets: MacroTargets,
): string {
  if (!week || week.loggedDays === 0) {
    return "No food logged this week yet.";
  }

  const parts: string[] = [];

  parts.push(
    `You reached your calorie target on ${week.calorieTargetDays} of ${week.loggedDays} logged ${
      week.loggedDays === 1 ? "day" : "days"
    }.`,
  );

  if (week.avgCalories != null) {
    const diff = week.avgCalories - targets.calories;
    const verb = diff >= 0 ? "above" : "below";
    parts.push(
      `You averaged ${Math.round(week.avgCalories).toLocaleString()} calories a day, ${Math.abs(
        Math.round(diff),
      ).toLocaleString()} ${verb} target.`,
    );
  }

  if (week.weightChange != null) {
    const c = week.weightChange;
    if (c >= 0.25 && c <= 0.6) {
      parts.push(
        `Average weight rose ${c.toFixed(1)} lb, which is right in the target range.`,
      );
    } else if (c > 0.6) {
      parts.push(
        `Average weight rose ${c.toFixed(1)} lb — faster than planned, which tends to add fat rather than muscle.`,
      );
    } else if (c > 0) {
      parts.push(`Average weight rose ${c.toFixed(1)} lb, a little under target.`);
    } else {
      parts.push(
        `Average weight fell ${Math.abs(c).toFixed(1)} lb despite the intake above.`,
      );
    }
  }

  return parts.join(" ");
}
