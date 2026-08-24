import { describe, expect, it } from "vitest";
import {
  compareReadings,
  formatPercentChange,
  METRICS,
  movingAgainstGoal,
  movingWithGoal,
} from "./body-composition";
import type { BodyComposition } from "@/types";

function reading(
  date: string,
  values: Partial<BodyComposition> = {},
): BodyComposition {
  return {
    id: date,
    userId: "me",
    date,
    bodyFatPercent: null,
    bmi: null,
    muscleMassLb: null,
    visceralFat: null,
    bodyWaterPercent: null,
    subcutaneousFatPercent: null,
    skeletalMusclePercent: null,
    boneMassLb: null,
    fatFreeMassLb: null,
    bmrKcal: null,
    proteinPercent: null,
    metabolicAge: null,
    ratings: null,
    source: "manual",
    createdAt: "",
    ...values,
  };
}

const find = (changes: ReturnType<typeof compareReadings>, key: string) =>
  changes.find((c) => c.def.key === key)!;

describe("metric definitions", () => {
  it("covers all twelve scale readings", () => {
    expect(METRICS).toHaveLength(12);
  });

  it("knows fat should fall and muscle should rise", () => {
    expect(METRICS.find((m) => m.key === "bodyFatPercent")!.better).toBe("down");
    expect(METRICS.find((m) => m.key === "visceralFat")!.better).toBe("down");
    expect(METRICS.find((m) => m.key === "metabolicAge")!.better).toBe("down");
    expect(METRICS.find((m) => m.key === "muscleMassLb")!.better).toBe("up");
    expect(METRICS.find((m) => m.key === "fatFreeMassLb")!.better).toBe("up");
  });

  it("treats BMI as neutral during a deliberate gain", () => {
    expect(METRICS.find((m) => m.key === "bmi")!.better).toBe("neutral");
  });
});

describe("compareReadings", () => {
  it("computes relative change against the previous reading", () => {
    const changes = compareReadings(
      reading("2026-09-01", { muscleMassLb: 115.7 }),
      reading("2026-08-01", { muscleMassLb: 113.4 }),
    );
    const muscle = find(changes, "muscleMassLb");

    expect(muscle.delta).toBeCloseTo(2.3, 5);
    expect(muscle.percentChange).toBeCloseTo(2.028, 2);
    expect(muscle.favorable).toBe(true);
  });

  it("calls falling body fat favorable and rising body fat not", () => {
    const down = find(
      compareReadings(
        reading("2026-09-01", { bodyFatPercent: 17.0 }),
        reading("2026-08-01", { bodyFatPercent: 17.5 }),
      ),
      "bodyFatPercent",
    );
    expect(down.favorable).toBe(true);

    const up = find(
      compareReadings(
        reading("2026-09-01", { bodyFatPercent: 18.2 }),
        reading("2026-08-01", { bodyFatPercent: 17.5 }),
      ),
      "bodyFatPercent",
    );
    // The same direction of travel that is good for muscle is bad here.
    expect(up.favorable).toBe(false);
  });

  it("calls a falling metabolic age favorable", () => {
    const c = find(
      compareReadings(
        reading("2026-09-01", { metabolicAge: 44 }),
        reading("2026-08-01", { metabolicAge: 46 }),
      ),
      "metabolicAge",
    );
    expect(c.favorable).toBe(true);
    expect(c.percentChange).toBeCloseTo(-4.35, 2);
  });

  it("never judges BMI", () => {
    const c = find(
      compareReadings(
        reading("2026-09-01", { bmi: 24.1 }),
        reading("2026-08-01", { bmi: 23.3 }),
      ),
      "bmi",
    );
    expect(c.percentChange).toBeGreaterThan(0);
    expect(c.favorable).toBeNull();
  });

  it("reports no change as neither favorable nor unfavorable", () => {
    const c = find(
      compareReadings(
        reading("2026-09-01", { bodyFatPercent: 17.5 }),
        reading("2026-08-01", { bodyFatPercent: 17.5 }),
      ),
      "bodyFatPercent",
    );
    expect(c.delta).toBe(0);
    expect(c.favorable).toBeNull();
  });

  it("leaves change null with nothing to compare against", () => {
    const c = find(
      compareReadings(reading("2026-09-01", { bodyFatPercent: 17.5 }), null),
      "bodyFatPercent",
    );
    expect(c.current).toBe(17.5);
    expect(c.percentChange).toBeNull();
    expect(c.favorable).toBeNull();
  });

  it("leaves change null when the metric is missing from one reading", () => {
    const c = find(
      compareReadings(
        reading("2026-09-01", { boneMassLb: 6.0 }),
        reading("2026-08-01"),
      ),
      "boneMassLb",
    );
    expect(c.percentChange).toBeNull();
  });

  it("carries the device's own rating through", () => {
    const c = find(
      compareReadings(
        reading("2026-09-01", {
          bodyFatPercent: 17.5,
          ratings: { bodyFatPercent: "Acceptable" },
        }),
        null,
      ),
      "bodyFatPercent",
    );
    expect(c.rating).toBe("Acceptable");
  });
});

describe("movingAgainstGoal", () => {
  it("flags a meaningful adverse move", () => {
    const changes = compareReadings(
      reading("2026-09-01", { bodyFatPercent: 19.0, muscleMassLb: 113.5 }),
      reading("2026-08-01", { bodyFatPercent: 17.5, muscleMassLb: 113.4 }),
    );

    const against = movingAgainstGoal(changes);
    expect(against.map((c) => c.def.key)).toEqual(["bodyFatPercent"]);
  });

  it("ignores wobble below the threshold", () => {
    // Bioimpedance readings drift with hydration; a 0.6% move is noise.
    const changes = compareReadings(
      reading("2026-09-01", { bodyFatPercent: 17.6 }),
      reading("2026-08-01", { bodyFatPercent: 17.5 }),
    );
    expect(movingAgainstGoal(changes)).toHaveLength(0);
  });

  it("separates favorable moves from adverse ones", () => {
    const changes = compareReadings(
      reading("2026-09-01", { bodyFatPercent: 16.5, muscleMassLb: 116 }),
      reading("2026-08-01", { bodyFatPercent: 17.5, muscleMassLb: 113.4 }),
    );

    expect(movingAgainstGoal(changes)).toHaveLength(0);
    expect(movingWithGoal(changes).map((c) => c.def.key).sort()).toEqual([
      "bodyFatPercent",
      "muscleMassLb",
    ]);
  });
});

describe("formatPercentChange", () => {
  it("signs the number and uses a real minus", () => {
    expect(formatPercentChange(2.03)).toBe("+2.0%");
    expect(formatPercentChange(-4.35)).toBe("−4.4%");
  });

  it("does not sign zero", () => {
    expect(formatPercentChange(0)).toBe("0%");
    expect(formatPercentChange(0.02)).toBe("0%");
  });

  it("renders a dash when there is nothing to compare", () => {
    expect(formatPercentChange(null)).toBe("—");
  });
});
