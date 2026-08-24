"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Heart, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { VerificationBadge } from "@/components/foods/verification-badge";
import { useAuth } from "@/lib/auth-context";
import { byUse, searchFoods, useFoods } from "@/lib/hooks/use-foods";
import { toggleFavorite } from "@/lib/repo/foods";
import { formatCalories, formatMacro } from "@/lib/nutrition";
import type { Food } from "@/types";

type Sort = "used" | "name";

export default function FoodsPage() {
  const { user } = useAuth();
  const { foods, loading } = useFoods(user?.uid ?? null);

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [favesOnly, setFavesOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("used");

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(foods.map((f) => f.category))).sort()],
    [foods],
  );

  const visible = useMemo(() => {
    let list = searchFoods(foods, term);
    if (category !== "all") list = list.filter((f) => f.category === category);
    if (favesOnly) list = list.filter((f) => f.isFavorite);
    return [...list].sort(
      sort === "used" ? byUse : (a, b) => a.name.localeCompare(b.name),
    );
  }, [foods, term, category, favesOnly, sort]);

  return (
    <main className="mx-auto max-w-lg">
      <PageHeader
        title="Foods"
        subtitle={`${foods.length} in your database`}
      />

      <div className="px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search foods"
            className="input h-12 w-full pl-10 pr-3 text-[15px]"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFavesOnly((v) => !v)}
            aria-pressed={favesOnly}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px]"
            style={{
              borderColor: favesOnly
                ? "rgba(255,91,110,0.4)"
                : "var(--border)",
              color: favesOnly ? "var(--danger)" : "var(--text-muted)",
            }}
          >
            <Heart
              className="h-3 w-3"
              fill={favesOnly ? "var(--danger)" : "none"}
            />
            Favorites
          </button>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="input h-8 shrink-0 px-2 text-[12px] capitalize"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort"
            className="input h-8 shrink-0 px-2 text-[12px]"
          >
            <option value="used">Most used</option>
            <option value="name">A–Z</option>
          </select>
        </div>

        <Link
          href="/foods/new"
          className="btn-primary pressable mt-3 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New food
        </Link>

        <div className="mt-4 space-y-2 pb-8">
          {loading ? (
            <p className="pt-8 text-center text-[13px] text-muted">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="px-6 pt-10 text-center text-[13px] leading-relaxed text-muted">
              {term || favesOnly || category !== "all"
                ? "Nothing matches those filters."
                : "No foods yet. Load the starter foods from Settings, or add one from a label."}
            </p>
          ) : (
            visible.map((food) => <FoodRow key={food.id} food={food} />)
          )}
        </div>
      </div>
    </main>
  );
}

function FoodRow({ food }: { food: Food }) {
  return (
    <div className="relative">
      <Link
        href={`/foods/${food.id}`}
        className="pressable block rounded-[12px] border border-white/[0.06] bg-surface/60 px-4 py-3 pr-20"
      >
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[15px] font-[600] text-foreground">
            {food.name}
          </span>
          {food.brand ? (
            <span className="shrink-0 truncate text-[12px] text-muted">
              {food.brand}
            </span>
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
            {formatMacro(food.proteinPerServing)}g P
          </span>
          <span className="text-fat">{formatMacro(food.fatPerServing)}g F</span>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <VerificationBadge status={food.verificationStatus} compact />
          {food.useCount > 0 ? (
            <span className="metric text-[11px] text-muted">
              logged {food.useCount}×
            </span>
          ) : null}
        </div>
      </Link>

      <button
        type="button"
        aria-label={
          food.isFavorite ? "Remove from favorites" : "Add to favorites"
        }
        aria-pressed={food.isFavorite}
        onClick={() => void toggleFavorite(food.id, !food.isFavorite)}
        className="absolute right-9 top-2 flex h-11 w-11 items-center justify-center"
      >
        <Heart
          className="h-[18px] w-[18px] text-muted"
          fill={food.isFavorite ? "var(--danger)" : "none"}
          stroke={food.isFavorite ? "var(--danger)" : "currentColor"}
          strokeWidth={1.75}
        />
      </button>

      <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}
