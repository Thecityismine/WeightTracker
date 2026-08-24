"use client";

import { Heart } from "lucide-react";
import { formatCalories, formatMacro } from "@/lib/nutrition";
import type { Food, VerificationStatus } from "@/types";

/** Source dot colors, per DESIGN.md. */
const SOURCE: Record<VerificationStatus, { color: string; label: string }> = {
  label_verified: { color: "var(--success)", label: "Nutrition label verified" },
  usda_verified: { color: "var(--blue)", label: "USDA verified" },
  user_entered: { color: "var(--text-muted)", label: "User entered" },
  ai_estimated: { color: "var(--warning)", label: "AI estimated" },
};

export function FoodCard({
  food,
  onSelect,
  onToggleFavorite,
}: {
  food: Food;
  onSelect: (food: Food) => void;
  onToggleFavorite?: (food: Food) => void;
}) {
  const source = SOURCE[food.verificationStatus] ?? SOURCE.user_entered;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onSelect(food)}
        className="pressable w-full rounded-[12px] border border-white/[0.06] bg-surface/60 px-4 py-3 text-left"
      >
        <div className="flex items-baseline justify-between gap-3 pr-7">
          <span className="truncate text-[15px] font-[600] text-foreground">
            {food.name}
          </span>
          {food.brand ? (
            <span className="shrink-0 text-[12px] text-muted">{food.brand}</span>
          ) : null}
        </div>

        <p className="mt-0.5 text-[13px] text-secondary">
          {food.servingDescription}
        </p>

        <div className="metric mt-2 flex items-center gap-3 text-[13px]">
          <span className="text-foreground">
            {formatCalories(food.caloriesPerServing)} kcal
          </span>
          <span className="text-protein">
            {formatMacro(food.proteinPerServing)}g protein
          </span>
          <span className="text-fat">
            {formatMacro(food.fatPerServing)}g fat
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: source.color }}
          />
          <span className="text-[11px] text-muted">{source.label}</span>
        </div>
      </button>

      {onToggleFavorite ? (
        <button
          type="button"
          aria-label={
            food.isFavorite ? "Remove from favorites" : "Add to favorites"
          }
          aria-pressed={food.isFavorite}
          onClick={() => onToggleFavorite(food)}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center"
        >
          <Heart
            className={
              food.isFavorite ? "h-[18px] w-[18px]" : "h-[18px] w-[18px] text-muted"
            }
            fill={food.isFavorite ? "var(--danger)" : "none"}
            stroke={food.isFavorite ? "var(--danger)" : "currentColor"}
            strokeWidth={1.75}
          />
        </button>
      ) : null}
    </div>
  );
}
