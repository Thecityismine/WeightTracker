"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Droplet } from "lucide-react";
import { formatCalories, formatMacro } from "@/lib/nutrition";
import type { Food } from "@/types";

/**
 * Cooking oil and seasoning, collapsed by default.
 *
 * These belong to most cooked meals but are logged far less often than they
 * are eaten — oil because it disappears into the pan, salt because it has no
 * calories to notice. Neither is harmless: a tablespoon of oil is 119 calories
 * and 13.5 g of fat, and a quarter teaspoon of salt is roughly 575 mg of
 * sodium.
 *
 * Collapsed so it never competes with logging the actual food, one tap away so
 * it is not a chore when it matters.
 */
const OIL_NAMES = ["Olive oil", "Butter", "Avocado oil", "Coconut oil"];
const SEASONING_CATEGORY = "condiment";

export function ExtrasRow({
  foods,
  onPick,
}: {
  foods: Food[];
  onPick: (food: Food) => void;
}) {
  const [open, setOpen] = useState(false);

  const { oils, seasonings } = useMemo(() => {
    const oils = foods
      .filter((f) => OIL_NAMES.includes(f.name) || f.category === "fat")
      .filter((f) => f.servingUnit === "tbsp" || f.servingUnit === "tsp")
      .sort((a, b) => a.name.localeCompare(b.name));

    const seasonings = foods
      .filter((f) => f.category === SEASONING_CATEGORY)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { oils, seasonings };
  }, [foods]);

  if (oils.length === 0 && seasonings.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 py-1.5 text-[12px] text-muted"
      >
        <Droplet className="h-3.5 w-3.5" />
        Oil &amp; seasoning
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="mb-1 rounded-[12px] border border-white/[0.06] bg-surface/40 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-muted">
            Record what ended up in <em>your</em> serving. One tablespoon of oil
            across four portions is a quarter tablespoon each — about 30
            calories and 3.4 g of fat.
          </p>

          {oils.length > 0 ? (
            <Group label="Cooking fat" foods={oils} onPick={onPick} />
          ) : null}
          {seasonings.length > 0 ? (
            <Group label="Seasoning" foods={seasonings} onPick={onPick} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Group({
  label,
  foods,
  onPick,
}: {
  label: string;
  foods: Food[];
  onPick: (food: Food) => void;
}) {
  return (
    <div className="mt-2.5">
      <p className="label-metric text-[10px]">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {foods.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f)}
            className="pressable rounded-full border border-white/[0.08] bg-surface px-3 py-1.5 text-left"
          >
            <span className="block text-[12px] text-foreground">{f.name}</span>
            <span className="metric block text-[10px] text-muted">
              {f.servingDescription} ·{" "}
              {f.sodiumMgPerServing != null && f.sodiumMgPerServing > 0
                ? `${Math.round(f.sodiumMgPerServing)}mg Na`
                : `${formatCalories(f.caloriesPerServing)} kcal`}
              {f.fatPerServing > 0
                ? ` · ${formatMacro(f.fatPerServing)}g fat`
                : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
