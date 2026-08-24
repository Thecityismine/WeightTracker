"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { NumberField } from "@/components/ui/number-field";
import { computeLogMacros, formatCalories, formatMacro } from "@/lib/nutrition";
import { MEAL_LABELS, type MealCategory } from "@/lib/constants";
import type { Food } from "@/types";

/**
 * Quarter-serving steps.
 *
 * Half was enough for scoops and containers, but not for cooking oil: a
 * tablespoon split across four bowls is a quarter tablespoon each, and that
 * quantity has to be reachable. The number is also directly editable for
 * anything finer.
 */
const STEP = 0.25;
const MAX = 20;

export function QuantitySheet({
  food,
  meal,
  open,
  busy,
  initialQuantity = 1,
  submitLabel,
  onClose,
  onConfirm,
}: {
  food: Food | null;
  meal: MealCategory;
  open: boolean;
  busy?: boolean;
  initialQuantity?: number;
  submitLabel?: string;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) {
  // Callers pass a `key` tied to the food being edited, so opening a
  // different food remounts this component with a fresh quantity. That is
  // cheaper and less bug-prone than resetting state from an effect.
  const [quantity, setQuantity] = useState(initialQuantity);

  if (!food) {
    return <Sheet open={false} onClose={onClose} label="Quantity">{null}</Sheet>;
  }

  // Live preview straight from the engine — the same function that will
  // compute the stored snapshot, so what is shown is exactly what is saved.
  const macros = computeLogMacros(food, quantity);

  const dec = () => setQuantity((q) => Math.max(STEP, roundStep(q - STEP)));
  const inc = () => setQuantity((q) => Math.min(MAX, roundStep(q + STEP)));

  return (
    <Sheet open={open} onClose={onClose} label={`Quantity for ${food.name}`}>
      <div className="px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-2">
        <h2 className="text-[20px] font-[650] tracking-tight text-foreground">
          {food.name}
        </h2>
        <p className="mt-0.5 text-[13px] text-secondary">
          {food.servingDescription} per serving
        </p>

        <div className="mt-6 flex items-center justify-center gap-7">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={dec}
            disabled={quantity <= STEP}
            className="btn-secondary pressable flex h-14 w-14 items-center justify-center rounded-full disabled:opacity-40"
          >
            <Minus className="h-5 w-5" strokeWidth={2.5} />
          </button>

          <NumberField
            value={quantity}
            onChange={(v) => setQuantity(Math.max(0, v))}
            step="0.25"
            ariaLabel="Quantity"
            className="metric min-w-[92px] bg-transparent text-center text-[36px] font-[650] leading-none text-foreground outline-none"
          />

          <button
            type="button"
            aria-label="Increase quantity"
            onClick={inc}
            disabled={quantity >= MAX}
            className="btn-secondary pressable flex h-14 w-14 items-center justify-center rounded-full disabled:opacity-40"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="metric text-[26px] font-[650] text-foreground">
            {formatCalories(macros.calories)} calories
          </p>
          <p className="metric mt-1 text-[14px] text-secondary">
            <span className="text-protein">{formatMacro(macros.protein)}g protein</span>
            {"  •  "}
            <span className="text-fat">{formatMacro(macros.fat)}g fat</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onConfirm(quantity)}
          disabled={busy}
          className="btn-primary pressable mt-7 h-13 w-full py-3.5 text-[15px] font-[600] disabled:opacity-60"
        >
          {submitLabel ?? `Add to ${MEAL_LABELS[meal]}`}
        </button>
      </div>
    </Sheet>
  );
}

/** Keep quarters clean — floating point turns 0.75-0.25 into 0.4999999 otherwise. */
function roundStep(n: number): number {
  return Math.round(n * 4) / 4;
}
