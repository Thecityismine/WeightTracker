import { describe, expect, it } from "vitest";
import {
  averageWeeklyGain,
  buildWeeks,
  computeProgress,
  detectStall,
  estimateGoalDate,
  interpretWeek,
  weekStartKey,
  type WeekSummary,
} from "./progress";
import type { DailyTotals, WeightLog } from "@/types";

const TARGETS = { calories: 2800, protein: 130, fat: 80 };

function totals(date: string, calories: number, protein = 130): DailyTotals {
  return {
    userId: "me",
    date,
    calories,
    protein,
    fat: 78,
    carbs: 300,
    fiber: 30,
    entryCount: 4,
    status: "ontarget",
    updatedAt: "",
  };
}

function weight(date: string, w: number): WeightLog {
  return {
    id: date,
    userId: "me",
    date,
    weight: w,
    waistMeasurement: null,
    note: null,
    createdAt: "",
  };
}

describe("weekStartKey", () => {
  it("returns the Sunday of that week", () => {
    // 2026-08-24 is a Monday; its week starts Sunday the 23rd.
    expect(weekStartKey("2026-08-24")).toBe("2026-08-23");
    expect(weekStartKey("2026-08-23")).toBe("2026-08-23");
    expect(weekStartKey("2026-08-29")).toBe("2026-08-23");
  });
});

describe("buildWeeks", () => {
  it("groups days and weigh-ins into weeks", () => {
    const weeks = buildWeeks(
      [totals("2026-08-23", 2800), totals("2026-08-24", 2600)],
      [weight("2026-08-23", 144.0), weight("2026-08-24", 144.4)],
      TARGETS,
    );

    expect(weeks).toHaveLength(1);
    expect(weeks[0].weekStart).toBe("2026-08-23");
    expect(weeks[0].loggedDays).toBe(2);
    expect(weeks[0].avgCalories).toBe(2700);
    expect(weeks[0].startWeight).toBe(144.0);
    expect(weeks[0].endWeight).toBe(144.4);
    expect(weeks[0].avgWeight).toBeCloseTo(144.2, 5);
  });

  it("counts days that reached each target", () => {
    const weeks = buildWeeks(
      [
        totals("2026-08-23", 2900, 140),
        totals("2026-08-24", 2500, 120),
        totals("2026-08-25", 2800, 130),
      ],
      [],
      TARGETS,
    );
    expect(weeks[0].calorieTargetDays).toBe(2);
    expect(weeks[0].proteinTargetDays).toBe(2);
  });

  it("ignores days with no entries", () => {
    const empty = { ...totals("2026-08-25", 0), entryCount: 0 };
    const weeks = buildWeeks([totals("2026-08-23", 2800), empty], [], TARGETS);
    expect(weeks[0].loggedDays).toBe(1);
    expect(weeks[0].avgCalories).toBe(2800);
  });

  it("compares weekly averages, not single mornings", () => {
    // Week 1 averages 144.0; week 2 averages 144.5. Change is +0.5, even
    // though the last reading of week 1 is higher than the first of week 2.
    const weeks = buildWeeks(
      [],
      [
        weight("2026-08-23", 143.5),
        weight("2026-08-26", 144.5),
        weight("2026-08-30", 144.0),
        weight("2026-09-02", 145.0),
      ],
      TARGETS,
    );

    expect(weeks).toHaveLength(2);
    expect(weeks[0].avgWeight).toBeCloseTo(144.0, 5);
    expect(weeks[1].avgWeight).toBeCloseTo(144.5, 5);
    expect(weeks[1].weightChange).toBeCloseTo(0.5, 5);
  });

  it("leaves the first week's change null — nothing to compare against", () => {
    const weeks = buildWeeks([], [weight("2026-08-23", 144)], TARGETS);
    expect(weeks[0].weightChange).toBeNull();
  });
});

describe("computeProgress", () => {
  it("measures the journey from start to goal", () => {
    const p = computeProgress(144, 149, 145.2);
    expect(p.gained).toBeCloseTo(1.2, 5);
    expect(p.remaining).toBeCloseTo(3.8, 5);
    expect(p.fraction).toBeCloseTo(0.24, 2);
    expect(p.reached).toBe(false);
  });

  it("knows when the goal is reached", () => {
    expect(computeProgress(144, 149, 149).reached).toBe(true);
    expect(computeProgress(144, 149, 150).reached).toBe(true);
  });

  it("clamps the fraction when weight drops below the start", () => {
    expect(computeProgress(144, 149, 143).fraction).toBe(0);
  });

  it("falls back to the starting weight with no weigh-ins", () => {
    const p = computeProgress(144, 149, null);
    expect(p.gained).toBe(0);
    expect(p.fraction).toBe(0);
  });
});

describe("estimateGoalDate", () => {
  it("projects from the current rate", () => {
    // 4 lb to go at 0.5 lb/week = 8 weeks = 56 days.
    expect(estimateGoalDate(4, 0.5, "2026-08-24")).toBe("2026-10-19");
  });

  it("refuses to project when weight is flat or falling", () => {
    expect(estimateGoalDate(4, 0, "2026-08-24")).toBeNull();
    expect(estimateGoalDate(4, -0.2, "2026-08-24")).toBeNull();
    expect(estimateGoalDate(4, null, "2026-08-24")).toBeNull();
  });

  it("refuses absurdly distant projections", () => {
    expect(estimateGoalDate(100, 0.02, "2026-08-24")).toBeNull();
  });

  it("returns today once the goal is met", () => {
    expect(estimateGoalDate(0, 0.5, "2026-08-24")).toBe("2026-08-24");
  });
});

describe("averageWeeklyGain", () => {
  it("averages only weeks that have a comparison", () => {
    const weeks = [
      { weightChange: null },
      { weightChange: 0.4 },
      { weightChange: 0.2 },
    ] as WeekSummary[];
    expect(averageWeeklyGain(weeks)).toBeCloseTo(0.3, 5);
  });

  it("returns null with no comparable weeks", () => {
    expect(averageWeeklyGain([{ weightChange: null }] as WeekSummary[])).toBeNull();
  });
});

describe("detectStall", () => {
  it("stays quiet until two full weeks exist", () => {
    const r = detectStall([{ weightChange: 0 }] as WeekSummary[], 2800);
    expect(r.stalled).toBe(false);
    expect(r.suggestedCalorieIncrease).toBe(0);
  });

  it("flags two flat weeks and suggests 150 more calories", () => {
    const weeks = [
      { weightChange: 0.0 },
      { weightChange: 0.0 },
    ] as WeekSummary[];
    const r = detectStall(weeks, 2800);
    expect(r.stalled).toBe(true);
    expect(r.suggestedCalorieIncrease).toBe(150);
    expect(r.message).toContain("2,950");
  });

  it("does not flag a single flat week following a gain", () => {
    const weeks = [
      { weightChange: 0.5 },
      { weightChange: 0.0 },
    ] as WeekSummary[];
    expect(detectStall(weeks, 2800).stalled).toBe(false);
  });

  it("flags a genuine plateau even after earlier progress", () => {
    const weeks = [
      { weightChange: 0.6 },
      { weightChange: 0.05 },
      { weightChange: 0.0 },
    ] as WeekSummary[];
    expect(detectStall(weeks, 2800).stalled).toBe(true);
  });
});

describe("interpretWeek", () => {
  it("says nothing confident about an empty week", () => {
    expect(interpretWeek(null, TARGETS)).toContain("No food logged");
  });

  it("reports target days and the average", () => {
    const week = {
      loggedDays: 7,
      calorieTargetDays: 5,
      avgCalories: 2746,
      weightChange: 0.3,
    } as WeekSummary;

    const text = interpretWeek(week, TARGETS);
    expect(text).toContain("5 of 7");
    expect(text).toContain("2,746");
    expect(text).toContain("target range");
  });

  it("warns when the gain is too fast", () => {
    const week = {
      loggedDays: 7,
      calorieTargetDays: 7,
      avgCalories: 3400,
      weightChange: 1.4,
    } as WeekSummary;
    expect(interpretWeek(week, TARGETS)).toContain("faster than planned");
  });

  it("notes a fall despite the intake", () => {
    const week = {
      loggedDays: 7,
      calorieTargetDays: 6,
      avgCalories: 2820,
      weightChange: -0.4,
    } as WeekSummary;
    expect(interpretWeek(week, TARGETS)).toContain("fell 0.4 lb");
  });
});
