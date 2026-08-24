"use client";

import { Minus, Plus } from "lucide-react";
import { NumberField } from "./number-field";

/**
 * Label on the left, − value + on the right.
 *
 * DESIGN.md calls for numeric steppers over open text fields wherever
 * possible — on a phone, tapping beats summoning a keyboard. The value is
 * still directly editable for a large jump.
 */
export function StepperRow({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 100000,
  suffix,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  decimals?: number;
}) {
  const clamp = (n: number) =>
    Math.min(max, Math.max(min, round(n, decimals)));

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[14px] text-secondary">{label}</span>

      <span className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="btn-secondary pressable flex h-11 w-11 items-center justify-center rounded-full"
        >
          <Minus className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <span className="flex items-baseline justify-center gap-1 px-1">
          <NumberField
            step={step}
            value={Number.isFinite(value) ? value : null}
            onChange={(v) => onChange(clamp(v))}
            ariaLabel={label}
            className="metric w-[68px] bg-transparent text-center text-[17px] font-[650] text-foreground outline-none"
          />
          {suffix ? (
            <span className="text-[12px] text-muted">{suffix}</span>
          ) : null}
        </span>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="btn-secondary pressable flex h-11 w-11 items-center justify-center rounded-full"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </span>
    </div>
  );
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
