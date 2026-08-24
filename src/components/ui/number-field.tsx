"use client";

import { useState } from "react";

/**
 * Numeric input that does not accumulate leading zeros.
 *
 * A plain `<input type="number" value={0}>` shows "0"; tapping it puts the
 * caret after that zero, so typing 105 produces "0105". The number parses
 * correctly but reads like a bug, and on a phone it happens every time.
 *
 * Fix: hold the raw text only while focused, and clear a zero on focus so
 * there is nothing to type behind. Blur restores the canonical value.
 * No effects, so nothing races the parent's state.
 */
export function NumberField({
  value,
  onChange,
  id,
  step,
  placeholder,
  className = "",
  ariaLabel,
  allowNull = false,
  onNull,
}: {
  value: number | null;
  onChange: (next: number) => void;
  id?: string;
  step?: string | number;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** Let the field be genuinely empty rather than snapping back to 0. */
  allowNull?: boolean;
  onNull?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const display =
    draft ?? (value == null ? "" : String(value));

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={display}
      className={className}
      onFocus={() => {
        // Tapping a field showing 0 should give an empty box, not a caret
        // parked behind a zero.
        setDraft(value == null || value === 0 ? "" : String(value));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);

        if (raw === "" || raw === "-") {
          if (allowNull && onNull) onNull();
          else onChange(0);
          return;
        }

        const parsed = Number(raw);
        if (Number.isFinite(parsed)) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
