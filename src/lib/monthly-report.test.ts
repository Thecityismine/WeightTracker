import { describe, expect, it } from "vitest";
import {
  buildMonthlyReport,
  describeCoverage,
  monthBounds,
} from "./monthly-report";
import type { FoodLog, WeightLog } from "@/types";

const TARGETS = { calories: 2800, protein: 130, fat: 80 };

function log(
  date: string,
  calories: number,
  extra: Partial<FoodLog> = {},
): FoodLog {
  return {
    id: `${date}-${Math.random()}`,
    userId: "me",
    foodId: "f",
    logDate: date,
    mealCategory: "breakfast",
    quantity: 1,
    nameSnapshot: "Food",
    servingDescriptionSnapshot: "1 serving",
    caloriesSnapshot: calories,
    proteinSnapshot: 20,
    fatSnapshot: 10,
    carbsSnapshot: 30,
    fiberSnapshot: 3,
    sugarSnapshot: null,
    saturatedFatSnapshot: null,
    cholesterolMgSnapshot: null,
    sodiumMgSnapshot: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

function weigh(date: string, weight: number): WeightLog {
  return {
    id: date,
    userId: "me",
    date,
    weight,
    waistMeasurement: null,
    note: null,
    createdAt: "",
  };
}

describe("monthBounds", () => {
  it("spans the whole month", () => {
    expect(monthBounds(2026, 7)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("handles February in a leap year", () => {
    expect(monthBounds(2028, 1).to).toBe("2028-02-29");
  });
});

describe("buildMonthlyReport", () => {
  it("summarizes core macros per logged day", () => {
    const r = buildMonthlyReport(
      "2026-08-01",
      "2026-08-31",
      [
        log("2026-08-01", 1400),
        log("2026-08-01", 1400),
        log("2026-08-02", 2000),
      ],
      [],
      TARGETS,
    );

    expect(r.daysLogged).toBe(2);
    expect(r.calories.total).toBe(4800);
    expect(r.calories.dailyAverage).toBe(2400);
    expect(r.calories.min).toBe(2000);
    expect(r.calories.max).toBe(2800);
    expect(r.calorieTargetDays).toBe(1);
  });

  it("ignores logs outside the month", () => {
    const r = buildMonthlyReport(
      "2026-08-01",
      "2026-08-31",
      [log("2026-07-31", 5000), log("2026-08-01", 2000), log("2026-09-01", 5000)],
      [],
      TARGETS,
    );
    expect(r.daysLogged).toBe(1);
    expect(r.calories.total).toBe(2000);
  });

  it("tracks weight across the month", () => {
    const r = buildMonthlyReport(
      "2026-08-01",
      "2026-08-31",
      [],
      [weigh("2026-08-02", 144.0), weigh("2026-08-20", 145.2), weigh("2026-08-10", 144.6)],
      TARGETS,
    );

    expect(r.weight.entries).toBe(3);
    // Ordered by date, not by insertion.
    expect(r.weight.start).toBe(144.0);
    expect(r.weight.end).toBe(145.2);
    expect(r.weight.change).toBeCloseTo(1.2, 5);
    expect(r.weight.min).toBe(144.0);
    expect(r.weight.max).toBe(145.2);
  });

  describe("secondary nutrient coverage", () => {
    it("is 100% when every food declares the value", () => {
      const r = buildMonthlyReport(
        "2026-08-01",
        "2026-08-31",
        [
          log("2026-08-01", 500, { sodiumMgSnapshot: 300 }),
          log("2026-08-01", 500, { sodiumMgSnapshot: 200 }),
        ],
        [],
        TARGETS,
      );

      expect(r.sodiumMg.coverage).toBe(1);
      expect(r.sodiumMg.total).toBe(500);
      expect(describeCoverage(r.sodiumMg).label).toBe("complete");
    });

    it("weights coverage by calories, not by entry count", () => {
      // One tiny labelled food and one large unlabelled one. Counting entries
      // would call this 50% covered; by calories it is 10%, which is the
      // number that actually tells a clinician how much is missing.
      const r = buildMonthlyReport(
        "2026-08-01",
        "2026-08-31",
        [
          log("2026-08-01", 100, { sodiumMgSnapshot: 50 }),
          log("2026-08-01", 900),
        ],
        [],
        TARGETS,
      );

      expect(r.sodiumMg.coverage).toBeCloseTo(0.1, 5);
      expect(r.sodiumMg.entriesWithData).toBe(1);
      expect(r.sodiumMg.entriesTotal).toBe(2);
    });

    it("calls a sparse figure a lower bound, never an average", () => {
      const r = buildMonthlyReport(
        "2026-08-01",
        "2026-08-31",
        [log("2026-08-01", 100, { sodiumMgSnapshot: 50 }), log("2026-08-01", 900)],
        [],
        TARGETS,
      );

      const described = describeCoverage(r.sodiumMg);
      expect(described.label).toBe("sparse");
      expect(described.wording).toContain("lower bound");
      // It must explicitly disclaim the word, not merely avoid it.
      expect(described.wording).toContain("not an average");
    });

    it("warns that intake is higher than shown at partial coverage", () => {
      const r = buildMonthlyReport(
        "2026-08-01",
        "2026-08-31",
        [log("2026-08-01", 700, { sodiumMgSnapshot: 400 }), log("2026-08-01", 300)],
        [],
        TARGETS,
      );
      expect(describeCoverage(r.sodiumMg).label).toBe("partial");
      expect(describeCoverage(r.sodiumMg).wording).toContain("higher than shown");
    });

    it("says plainly when a nutrient was never recorded", () => {
      const r = buildMonthlyReport(
        "2026-08-01",
        "2026-08-31",
        [log("2026-08-01", 2000)],
        [],
        TARGETS,
      );

      expect(r.sodiumMg.coverage).toBe(0);
      expect(r.sodiumMg.total).toBe(0);
      expect(describeCoverage(r.sodiumMg).label).toBe("none");
    });

    it("leaves a day's value null when no food that day declared it", () => {
      const r = buildMonthlyReport(
        "2026-08-01",
        "2026-08-31",
        [
          log("2026-08-01", 500, { sodiumMgSnapshot: 300 }),
          log("2026-08-02", 500),
        ],
        [],
        TARGETS,
      );

      expect(r.days[0].sodiumMg).toBe(300);
      // Not zero — nothing that day reported sodium at all.
      expect(r.days[1].sodiumMg).toBeNull();
    });
  });

  it("includes weigh-in-only days in the daily table", () => {
    const r = buildMonthlyReport(
      "2026-08-01",
      "2026-08-31",
      [log("2026-08-01", 2000)],
      [weigh("2026-08-05", 145)],
      TARGETS,
    );

    expect(r.days).toHaveLength(2);
    expect(r.days[1].date).toBe("2026-08-05");
    expect(r.days[1].calories).toBe(0);
    // A day with a weigh-in but no food must not count as a logged day.
    expect(r.daysLogged).toBe(1);
  });

  it("survives an empty month without dividing by zero", () => {
    const r = buildMonthlyReport("2026-08-01", "2026-08-31", [], [], TARGETS);
    expect(r.daysLogged).toBe(0);
    expect(r.calories.dailyAverage).toBe(0);
    expect(r.sodiumMg.coverage).toBe(0);
    expect(r.days).toEqual([]);
  });
});

describe("contributor tables", () => {
  it("ranks sodium sources by their contribution, not their calories", () => {
    const r = buildMonthlyReport(
      "2026-08-01",
      "2026-08-31",
      [
        log("2026-08-01", 5, { nameSnapshot: "Table salt", sodiumMgSnapshot: 1160 }),
        log("2026-08-01", 700, { nameSnapshot: "Chicken breast", sodiumMgSnapshot: 104 }),
      ],
      [],
      TARGETS,
    );

    // The near-zero-calorie item is the dominant sodium source, which is the
    // whole reason this table exists.
    expect(r.topSodium[0].name).toBe("Table salt");
    expect(r.topSodium[0].sodiumMg).toBe(1160);
    expect(r.topCalories[0].name).toBe("Chicken breast");
  });

  it("aggregates repeat entries of the same food", () => {
    const r = buildMonthlyReport(
      "2026-08-01",
      "2026-08-31",
      [
        log("2026-08-01", 119, { nameSnapshot: "Olive oil" }),
        log("2026-08-02", 119, { nameSnapshot: "Olive oil" }),
      ],
      [],
      TARGETS,
    );

    expect(r.topCalories[0].name).toBe("Olive oil");
    expect(r.topCalories[0].entries).toBe(2);
    expect(r.topCalories[0].calories).toBe(238);
  });

  it("omits foods with no sodium recorded from the sodium table", () => {
    const r = buildMonthlyReport(
      "2026-08-01",
      "2026-08-31",
      [log("2026-08-01", 500, { nameSnapshot: "Mystery food" })],
      [],
      TARGETS,
    );
    expect(r.topSodium).toHaveLength(0);
  });
});
