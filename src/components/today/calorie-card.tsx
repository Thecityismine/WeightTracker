"use client";

import { Card, SectionLabel } from "@/components/ui/card";
import {
  formatCalories,
  isTargetReached,
  progressPercent,
} from "@/lib/nutrition";

/**
 * The single dominant visualization on the screen.
 *
 * Design rule: one primary progress bar, never a ring per metric. And once
 * the target is reached the bar turns green — it never says "over". Reaching
 * a controlled surplus is the mission.
 */
export function CalorieCard({
  consumed,
  target,
}: {
  consumed: number;
  target: number;
}) {
  const pct = progressPercent(consumed, target);
  const reached = isTargetReached(consumed, target);
  const remaining = target - consumed;

  return (
    <Card className="relative overflow-hidden px-5 py-6">
      {/* Faint glow behind the number, brightening as the target nears. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full"
        style={{
          background: reached
            ? "radial-gradient(circle, rgba(45,219,140,0.16), transparent 70%)"
            : "radial-gradient(circle, rgba(0,168,255,0.14), transparent 70%)",
        }}
      />

      <div className="relative">
        <SectionLabel>Today</SectionLabel>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="metric text-[44px] font-[650] leading-none text-foreground">
            {formatCalories(consumed)}
          </span>
          <span className="text-[15px] text-muted">
            of {formatCalories(target)} calories
          </span>
        </div>

        <div className="progress-track mt-5 h-2.5 w-full">
          <div
            className={`progress-fill ${
              reached ? "progress-complete" : "progress-calories"
            }`}
            style={{ width: `${Math.max(pct, consumed > 0 ? 2 : 0)}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="metric text-[13px] text-muted">
            {Math.round(pct)}%
          </span>
          <span
            className="metric text-[13px]"
            style={{ color: reached ? "var(--success)" : "var(--blue)" }}
          >
            {reached
              ? `${formatCalories(Math.abs(remaining))} surplus`
              : `${formatCalories(remaining)} remaining`}
          </span>
        </div>
      </div>
    </Card>
  );
}
