import { dateKeyRange, toDateKey, type DateKey } from "./dates";
import { compareReadings, movingAgainstGoal, type MetricChange } from "./body-composition";
import type { BodyComposition, FoodLog, MacroTargets, WeightLog } from "@/types";

/**
 * Monthly nutrition report, intended to be handed to a clinician.
 *
 * The governing constraint: a doctor reading this will make recommendations
 * from it, so it must never overstate what the data supports.
 *
 * That matters most for the four secondary values. Sodium, sugar, cholesterol
 * and saturated fat are recorded per food, and many foods simply do not carry
 * them. Averaging only the foods that do, and printing the result as "average
 * daily sodium", would understate real intake by whatever share of the diet
 * was unlabelled — and a clinician has no way to see that from the number.
 *
 * So every secondary nutrient reports COVERAGE alongside its total: the
 * fraction of the month's calories that came from foods which actually
 * declared that nutrient. A figure at 30% coverage is a floor, not an average,
 * and the report says so in those words.
 */

export type CoreStat = {
  total: number;
  dailyAverage: number;
  min: number;
  max: number;
};

export type PartialStat = {
  /** Sum across entries that declared a value. */
  total: number;
  /** Total ÷ days logged. A floor when coverage is below 1. */
  dailyAverage: number;
  /** 0–1: share of the month's calories from foods declaring this nutrient. */
  coverage: number;
  entriesWithData: number;
  entriesTotal: number;
};

export type DayRow = {
  date: DateKey;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  sugar: number | null;
  saturatedFat: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  weight: number | null;
};

/** A food's contribution to the month, for the top-contributors tables. */
export type Contributor = {
  name: string;
  entries: number;
  calories: number;
  sodiumMg: number | null;
  saturatedFat: number | null;
  sugar: number | null;
};

export type MonthlyReport = {
  from: DateKey;
  to: DateKey;
  daysInMonth: number;
  daysLogged: number;
  entriesTotal: number;

  calories: CoreStat;
  protein: CoreStat;
  fat: CoreStat;
  carbs: CoreStat;
  fiber: CoreStat;

  sugar: PartialStat;
  saturatedFat: PartialStat;
  cholesterolMg: PartialStat;
  sodiumMg: PartialStat;
  potassiumMg: PartialStat;

  weight: {
    entries: number;
    start: number | null;
    end: number | null;
    min: number | null;
    max: number | null;
    average: number | null;
    change: number | null;
  };

  targets: MacroTargets;
  calorieTargetDays: number;
  proteinTargetDays: number;

  days: DayRow[];

  /**
   * Biggest sodium sources, and the biggest sources overall.
   *
   * A clinician asking "where is the sodium coming from" wants the answer by
   * name, not a single monthly figure. Seasoning blends and salt dominate this
   * list while contributing almost no calories, which is exactly the pattern
   * that a calorie-only log hides.
   */
  topSodium: Contributor[];
  topCalories: Contributor[];

  /**
   * Body composition, comparing the latest reading in the month against the
   * most recent one before it. Null when there is no reading in the month.
   */
  composition: {
    current: BodyComposition;
    previous: BodyComposition | null;
    changes: MetricChange[];
    against: MetricChange[];
  } | null;
};

export function buildMonthlyReport(
  from: DateKey,
  to: DateKey,
  logs: FoodLog[],
  weights: WeightLog[],
  targets: MacroTargets,
  compositions: BodyComposition[] = [],
): MonthlyReport {
  const allDates = dateKeyRange(from, to);

  const byDate = new Map<DateKey, FoodLog[]>();
  for (const log of logs) {
    if (log.logDate < from || log.logDate > to) continue;
    const list = byDate.get(log.logDate) ?? [];
    list.push(log);
    byDate.set(log.logDate, list);
  }

  const weightByDate = new Map<DateKey, number>();
  for (const w of weights) {
    if (w.date < from || w.date > to) continue;
    weightByDate.set(w.date, w.weight);
  }

  const days: DayRow[] = [];
  for (const date of allDates) {
    const dayLogs = byDate.get(date) ?? [];
    const weight = weightByDate.get(date) ?? null;
    if (dayLogs.length === 0 && weight == null) continue;

    days.push({
      date,
      calories: sum(dayLogs.map((l) => l.caloriesSnapshot)),
      protein: sum(dayLogs.map((l) => l.proteinSnapshot)),
      fat: sum(dayLogs.map((l) => l.fatSnapshot)),
      carbs: sum(dayLogs.map((l) => l.carbsSnapshot)),
      fiber: sum(dayLogs.map((l) => l.fiberSnapshot)),
      sugar: sumPartial(dayLogs.map((l) => l.sugarSnapshot)),
      saturatedFat: sumPartial(dayLogs.map((l) => l.saturatedFatSnapshot)),
      cholesterolMg: sumPartial(dayLogs.map((l) => l.cholesterolMgSnapshot)),
      sodiumMg: sumPartial(dayLogs.map((l) => l.sodiumMgSnapshot)),
      potassiumMg: sumPartial(dayLogs.map((l) => l.potassiumMgSnapshot)),
      weight,
    });
  }

  const loggedDays = days.filter((d) => d.calories > 0 || byDate.has(d.date));
  const daysLogged = [...byDate.keys()].length;

  const inRange = logs.filter((l) => l.logDate >= from && l.logDate <= to);
  const totalCalories = sum(inRange.map((l) => l.caloriesSnapshot));

  const core = (pick: (d: DayRow) => number): CoreStat => {
    const values = loggedDays
      .filter((d) => byDate.has(d.date))
      .map(pick);
    return {
      total: sum(values),
      dailyAverage: values.length ? sum(values) / values.length : 0,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
    };
  };

  const partial = (pick: (l: FoodLog) => number | null): PartialStat => {
    const withData = inRange.filter((l) => pick(l) != null);
    const covered = sum(withData.map((l) => l.caloriesSnapshot));
    const total = sum(withData.map((l) => pick(l) ?? 0));

    return {
      total,
      dailyAverage: daysLogged ? total / daysLogged : 0,
      coverage: totalCalories > 0 ? covered / totalCalories : 0,
      entriesWithData: withData.length,
      entriesTotal: inRange.length,
    };
  };

  const weightValues = days
    .map((d) => d.weight)
    .filter((w): w is number => w != null);

  const withWeight = days.filter((d) => d.weight != null);
  const start = withWeight.length ? withWeight[0].weight : null;
  const end = withWeight.length ? withWeight[withWeight.length - 1].weight : null;

  const byFood = new Map<string, Contributor>();
  for (const l of inRange) {
    const key = l.nameSnapshot;
    const c: Contributor = byFood.get(key) ?? {
      name: key,
      entries: 0,
      calories: 0,
      sodiumMg: null,
      saturatedFat: null,
      sugar: null,
    };
    c.entries += 1;
    c.calories += l.caloriesSnapshot;
    if (l.sodiumMgSnapshot != null) {
      c.sodiumMg = (c.sodiumMg ?? 0) + l.sodiumMgSnapshot;
    }
    if (l.saturatedFatSnapshot != null) {
      c.saturatedFat = (c.saturatedFat ?? 0) + l.saturatedFatSnapshot;
    }
    if (l.sugarSnapshot != null) {
      c.sugar = (c.sugar ?? 0) + l.sugarSnapshot;
    }
    byFood.set(key, c);
  }

  const contributors = [...byFood.values()];

  // Latest reading inside the month, compared against the last one before it —
  // "progress since last month" rather than progress within the month.
  const sortedComps = [...compositions].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const inMonth = sortedComps.filter((c) => c.date >= from && c.date <= to);
  const beforeMonth = sortedComps.filter((c) => c.date < from);

  const currentComp = inMonth.length ? inMonth[inMonth.length - 1] : null;
  const previousComp = beforeMonth.length
    ? beforeMonth[beforeMonth.length - 1]
    : inMonth.length > 1
      ? inMonth[0]
      : null;

  const compChanges = currentComp
    ? compareReadings(currentComp, previousComp)
    : [];

  return {
    from,
    to,
    daysInMonth: allDates.length,
    daysLogged,
    entriesTotal: inRange.length,

    calories: core((d) => d.calories),
    protein: core((d) => d.protein),
    fat: core((d) => d.fat),
    carbs: core((d) => d.carbs),
    fiber: core((d) => d.fiber),

    sugar: partial((l) => l.sugarSnapshot),
    saturatedFat: partial((l) => l.saturatedFatSnapshot),
    cholesterolMg: partial((l) => l.cholesterolMgSnapshot),
    sodiumMg: partial((l) => l.sodiumMgSnapshot),
    potassiumMg: partial((l) => l.potassiumMgSnapshot),

    weight: {
      entries: weightValues.length,
      start,
      end,
      min: weightValues.length ? Math.min(...weightValues) : null,
      max: weightValues.length ? Math.max(...weightValues) : null,
      average: weightValues.length ? sum(weightValues) / weightValues.length : null,
      change: start != null && end != null ? end - start : null,
    },

    targets,
    calorieTargetDays: loggedDays.filter(
      (d) => byDate.has(d.date) && d.calories >= targets.calories,
    ).length,
    proteinTargetDays: loggedDays.filter(
      (d) => byDate.has(d.date) && d.protein >= targets.protein,
    ).length,

    days,

    topSodium: contributors
      .filter((c) => (c.sodiumMg ?? 0) > 0)
      .sort((a, b) => (b.sodiumMg ?? 0) - (a.sodiumMg ?? 0))
      .slice(0, 10),
    topCalories: [...contributors]
      .sort((a, b) => b.calories - a.calories)
      .slice(0, 10),

    composition: currentComp
      ? {
          current: currentComp,
          previous: previousComp,
          changes: compChanges,
          against: movingAgainstGoal(compChanges),
        }
      : null,
  };
}

/**
 * How a partial figure should be described in the report.
 *
 * The wording is deliberate: below full coverage the number is called a
 * minimum, never an average, because a clinician acting on an understated
 * sodium figure could reach the opposite of the right conclusion.
 */
export function describeCoverage(stat: PartialStat): {
  label: "complete" | "partial" | "sparse" | "none";
  wording: string;
} {
  if (stat.entriesWithData === 0) {
    return { label: "none", wording: "Not recorded for any food this month." };
  }

  const pct = Math.round(stat.coverage * 100);

  if (stat.coverage >= 0.995) {
    return { label: "complete", wording: "Recorded for every food logged." };
  }
  if (stat.coverage >= 0.5) {
    return {
      label: "partial",
      wording: `Recorded for foods making up ${pct}% of calories eaten. Actual intake is higher than shown.`,
    };
  }
  return {
    label: "sparse",
    wording: `Recorded for foods making up only ${pct}% of calories eaten. Treat this as a lower bound, not an average.`,
  };
}

/** Month bounds for a YYYY-MM key. */
export function monthBounds(year: number, month: number): {
  from: DateKey;
  to: DateKey;
} {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { from: toDateKey(first), to: toDateKey(last) };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Null when nothing in the day declared a value at all. */
function sumPartial(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  return known.length ? sum(known) : null;
}
