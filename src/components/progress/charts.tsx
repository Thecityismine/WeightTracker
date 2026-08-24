"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Chart chrome shared by every plot.
 *
 * DESIGN.md: faint horizontal grid lines only — no grid boxes, no vertical
 * rules, no axis lines. The data should be the only thing with weight.
 */
const AXIS = {
  stroke: "var(--text-muted)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
} as const;

const GRID = (
  <CartesianGrid
    vertical={false}
    stroke="rgba(255,255,255,0.05)"
    strokeDasharray="0"
  />
);

const TOOLTIP = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: "var(--text-muted)" },
} as const;

export type WeightPoint = {
  date: string;
  label: string;
  weight: number | null;
  average: number | null;
};

/** Daily weight in muted gray, the seven-day average in electric blue. */
export function WeightChart({ data }: { data: WeightPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
        {GRID}
        <XAxis dataKey="label" {...AXIS} minTickGap={24} />
        <YAxis
          {...AXIS}
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v: number) => v.toFixed(0)}
          width={34}
        />
        <Tooltip {...TOOLTIP} />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          dot={{ r: 2, fill: "var(--text-muted)" }}
          connectNulls
          name="Daily"
        />
        <Line
          type="monotone"
          dataKey="average"
          stroke="var(--blue)"
          strokeWidth={2.5}
          dot={false}
          connectNulls
          name="7-day avg"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type DailyPoint = { label: string; value: number };

/** Daily intake against a thin horizontal target line. */
export function DailyChart({
  data,
  target,
  color,
}: {
  data: DailyPoint[];
  target: number;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
        {GRID}
        <XAxis dataKey="label" {...AXIS} minTickGap={24} />
        <YAxis {...AXIS} width={34} />
        <Tooltip {...TOOLTIP} />
        <ReferenceLine
          y={target}
          stroke="rgba(255,255,255,0.28)"
          strokeDasharray="3 3"
        />
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} name="Logged" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export type WeeklyPoint = {
  label: string;
  calories: number | null;
  change: number | null;
};

/** Weekly intake against the weight change it produced. */
export function IntakeVsChangeChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <ComposedChart data={data} margin={{ top: 8, right: 2, bottom: 0, left: -18 }}>
        {GRID}
        <XAxis dataKey="label" {...AXIS} />
        <YAxis yAxisId="cal" {...AXIS} width={38} />
        <YAxis
          yAxisId="chg"
          orientation="right"
          {...AXIS}
          width={30}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <Tooltip {...TOOLTIP} />
        <Bar
          yAxisId="cal"
          dataKey="calories"
          fill="rgba(0,168,255,0.35)"
          radius={[3, 3, 0, 0]}
          name="Avg calories"
        />
        <Line
          yAxisId="chg"
          type="monotone"
          dataKey="change"
          stroke="var(--success)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "var(--success)" }}
          connectNulls
          name="Weight change"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
