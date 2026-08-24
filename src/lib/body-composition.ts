import type { BodyComposition } from "@/types";

/**
 * Smart-scale body composition.
 *
 * The delicate part is direction. These twelve metrics do not share a "good"
 * way to move: rising muscle mass is progress, rising body fat is not, and a
 * falling metabolic age is an improvement while falling bone mass is not. A
 * single green-for-up rule would paint encouragement over a bad trend, so
 * every metric declares which way it wants to go.
 *
 * BMI is deliberately neutral. The whole point of this plan is to gain weight,
 * so a rising BMI is the intended outcome, not a warning — and not a triumph
 * either, since BMI cannot tell muscle from fat.
 */

export type Direction = "up" | "down" | "neutral";

export type MetricKey = keyof Omit<
  BodyComposition,
  "id" | "userId" | "date" | "ratings" | "source" | "createdAt"
>;

export type MetricDef = {
  key: MetricKey;
  label: string;
  unit: string;
  /** Which way counts as progress toward a lean gain. */
  better: Direction;
  decimals: number;
  /** Why this direction, shown in the report. */
  note: string;
};

export const METRICS: MetricDef[] = [
  {
    key: "bodyFatPercent",
    label: "Body fat",
    unit: "%",
    better: "down",
    decimals: 1,
    note: "Gaining weight while body fat percentage holds or falls means the gain is mostly lean tissue.",
  },
  {
    key: "bmi",
    label: "BMI",
    unit: "",
    better: "neutral",
    decimals: 1,
    note: "Expected to rise during a deliberate weight gain. BMI cannot distinguish muscle from fat.",
  },
  {
    key: "muscleMassLb",
    label: "Muscle mass",
    unit: "lb",
    better: "up",
    decimals: 1,
    note: "The number this plan is actually trying to move.",
  },
  {
    key: "visceralFat",
    label: "Visceral fat",
    unit: "",
    better: "down",
    decimals: 0,
    note: "Fat around the organs. The one fat measure with direct clinical relevance.",
  },
  {
    key: "bodyWaterPercent",
    label: "Body water",
    unit: "%",
    better: "up",
    decimals: 1,
    note: "Moves with hydration as much as with body composition; read it loosely.",
  },
  {
    key: "subcutaneousFatPercent",
    label: "Subcutaneous fat",
    unit: "%",
    better: "down",
    decimals: 1,
    note: "Fat under the skin, the bulk of total body fat.",
  },
  {
    key: "skeletalMusclePercent",
    label: "Skeletal muscle",
    unit: "%",
    better: "up",
    decimals: 1,
    note: "Muscle as a share of body weight. Can fall during a gain even as muscle mass rises.",
  },
  {
    key: "boneMassLb",
    label: "Bone mass",
    unit: "lb",
    better: "up",
    decimals: 1,
    note: "Changes very slowly. Large short-term swings usually mean measurement noise.",
  },
  {
    key: "fatFreeMassLb",
    label: "Fat-free weight",
    unit: "lb",
    better: "up",
    decimals: 1,
    note: "Everything that is not fat. Rising alongside body weight is the goal.",
  },
  {
    key: "bmrKcal",
    label: "BMR",
    unit: "kcal",
    better: "up",
    decimals: 0,
    note: "Estimated resting burn. Rises with lean mass, and raises the calories needed to keep gaining.",
  },
  {
    key: "proteinPercent",
    label: "Protein",
    unit: "%",
    better: "up",
    decimals: 1,
    note: "Protein as a share of body weight, a proxy for lean tissue.",
  },
  {
    key: "metabolicAge",
    label: "Metabolic age",
    unit: "yrs",
    better: "down",
    decimals: 0,
    note: "The device's own composite estimate. Lower is better; treat it as a rough index.",
  },
];

export type MetricChange = {
  def: MetricDef;
  current: number | null;
  previous: number | null;
  /** Relative change, as a percentage of the previous reading. */
  percentChange: number | null;
  /** Raw difference in the metric's own units. */
  delta: number | null;
  /** Whether the move is toward the goal. Null when neutral or unknown. */
  favorable: boolean | null;
  rating: string | null;
};

/**
 * Compare two readings.
 *
 * Percent change is relative to the previous reading, including for metrics
 * already expressed in percent — body fat moving 17.5 to 17.0 reports −2.9%,
 * not −0.5. The raw delta is kept alongside so a reader who wants points
 * rather than percent has it.
 */
export function compareReadings(
  current: BodyComposition | null,
  previous: BodyComposition | null,
): MetricChange[] {
  return METRICS.map((def) => {
    const cur = current ? (current[def.key] as number | null) : null;
    const prev = previous ? (previous[def.key] as number | null) : null;

    let percentChange: number | null = null;
    let delta: number | null = null;

    if (cur != null && prev != null && prev !== 0) {
      delta = cur - prev;
      percentChange = (delta / Math.abs(prev)) * 100;
    }

    let favorable: boolean | null = null;
    if (delta != null && def.better !== "neutral" && delta !== 0) {
      favorable = def.better === "up" ? delta > 0 : delta < 0;
    }

    return {
      def,
      current: cur,
      previous: prev,
      percentChange,
      delta,
      favorable,
      rating: current?.ratings?.[def.key] ?? null,
    };
  });
}

/**
 * Metrics that moved against the goal by more than a trivial amount.
 *
 * The threshold exists because these scales are bioimpedance devices: readings
 * shift with hydration, time of day and how recently you ate. Flagging every
 * 0.2% wobble would bury the one number that actually moved.
 */
export function movingAgainstGoal(
  changes: MetricChange[],
  thresholdPercent = 1,
): MetricChange[] {
  return changes.filter(
    (c) =>
      c.favorable === false &&
      c.percentChange != null &&
      Math.abs(c.percentChange) >= thresholdPercent,
  );
}

export function movingWithGoal(
  changes: MetricChange[],
  thresholdPercent = 1,
): MetricChange[] {
  return changes.filter(
    (c) =>
      c.favorable === true &&
      c.percentChange != null &&
      Math.abs(c.percentChange) >= thresholdPercent,
  );
}

/** Format a metric value in its own units. */
export function formatMetric(value: number | null, def: MetricDef): string {
  if (value == null) return "—";
  return value.toFixed(def.decimals);
}

/** Signed percentage, e.g. "+2.4%" or "−0.8%". */
export function formatPercentChange(percent: number | null): string {
  if (percent == null) return "—";

  // Round the magnitude, not the signed value. Math.round breaks .5 toward
  // positive infinity, so rounding first would turn +4.35 into 4.4 and -4.35
  // into 4.3 — the same size of change displayed differently depending on
  // which way it went.
  const magnitude = Math.round(Math.abs(percent) * 10) / 10;
  if (magnitude === 0) return "0%";

  return `${percent > 0 ? "+" : "−"}${magnitude.toFixed(1)}%`;
}
