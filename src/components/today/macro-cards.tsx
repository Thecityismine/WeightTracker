"use client";

import { Card } from "@/components/ui/card";
import { formatMacro, progressPercent } from "@/lib/nutrition";

/**
 * Protein, fat and carbohydrate beneath the calorie card.
 *
 * Fat is the one metric with a real ceiling: past target it turns amber,
 * because "get the calories without blowing past 80 g of fat" is the actual
 * daily problem. Protein and carbohydrate past target stay green — more
 * protein is fine, and carbohydrate is the macro that fills whatever calories
 * the other two leave behind.
 */
export function MacroCards({
  protein,
  fat,
  carbs,
  proteinTarget,
  fatTarget,
  carbTarget,
}: {
  protein: number;
  fat: number;
  carbs: number;
  proteinTarget: number;
  fatTarget: number;
  carbTarget: number;
}) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
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
      <MacroCard
        label="Carbs"
        consumed={carbs}
        target={carbTarget}
        fillClass="progress-carbs"
        overIsWarning={false}
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
  const reached = target > 0 && consumed >= target;
  const remaining = target - consumed;

  const noteColor = !reached
    ? "var(--text-muted)"
    : overIsWarning
      ? "var(--warning)"
      : "var(--success)";

  return (
    <Card className="px-3 py-3.5">
      <p className="label-metric text-[11px]">{label}</p>

      <p className="metric mt-1.5 text-[19px] font-[650] leading-none text-foreground">
        {formatMacro(consumed)}
        <span className="text-[12px] font-[450] text-muted">
          {"/"}
          {formatMacro(target)}g
        </span>
      </p>

      <div className="progress-track mt-2.5 h-1.5 w-full">
        <div
          className={`progress-fill ${reached && overIsWarning ? "" : fillClass}`}
          style={{
            width: `${Math.max(pct, consumed > 0 ? 3 : 0)}%`,
            background: reached && overIsWarning ? "var(--warning)" : undefined,
          }}
        />
      </div>

      <p className="metric mt-1.5 text-[11px]" style={{ color: noteColor }}>
        {reached
          ? `${formatMacro(Math.abs(remaining))}g over`
          : `${formatMacro(remaining)}g left`}
      </p>
    </Card>
  );
}
