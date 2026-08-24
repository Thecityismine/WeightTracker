"use client";

import { Card } from "@/components/ui/card";
import { formatMacro, progressPercent } from "@/lib/nutrition";

/**
 * Protein and fat, half-width each beneath the calorie card.
 *
 * Fat is the one metric with a real ceiling: past target it turns amber,
 * because "get the calories without blowing past 80 g of fat" is the actual
 * daily problem. Protein past target stays green — more is fine.
 */
export function MacroCards({
  protein,
  fat,
  proteinTarget,
  fatTarget,
}: {
  protein: number;
  fat: number;
  proteinTarget: number;
  fatTarget: number;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <MacroCard
        label="Protein"
        consumed={protein}
        target={proteinTarget}
        fillClass="progress-protein"
        overIsWarning={false}
      />
      <MacroCard
        label="Fat"
        consumed={fat}
        target={fatTarget}
        fillClass="progress-fat"
        overIsWarning
      />
    </div>
  );
}

function MacroCard({
  label,
  consumed,
  target,
  fillClass,
  overIsWarning,
}: {
  label: string;
  consumed: number;
  target: number;
  fillClass: string;
  overIsWarning: boolean;
}) {
  const pct = progressPercent(consumed, target);
  const reached = consumed >= target;
  const remaining = target - consumed;

  const noteColor = !reached
    ? "var(--text-muted)"
    : overIsWarning
      ? "var(--warning)"
      : "var(--success)";

  return (
    <Card className="px-4 py-4">
      <p className="label-metric">{label}</p>

      <p className="metric mt-1.5 text-[22px] font-[650] leading-none text-foreground">
        {formatMacro(consumed)}
        <span className="text-[14px] font-[450] text-muted">
          {" / "}
          {formatMacro(target)}g
        </span>
      </p>

      <div className="progress-track mt-3 h-1.5 w-full">
        <div
          className={`progress-fill ${reached && overIsWarning ? "" : fillClass}`}
          style={{
            width: `${Math.max(pct, consumed > 0 ? 3 : 0)}%`,
            background:
              reached && overIsWarning ? "var(--warning)" : undefined,
          }}
        />
      </div>

      <p className="metric mt-2 text-[12px]" style={{ color: noteColor }}>
        {reached
          ? `${formatMacro(Math.abs(remaining))}g over`
          : `${formatMacro(remaining)}g remaining`}
      </p>
    </Card>
  );
}
