"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Database, Search, Sparkles } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { FoodCard } from "./food-card";
import { QuantitySheet } from "./quantity-sheet";
import { useAuth } from "@/lib/auth-context";
import { useFoodPicker } from "@/lib/food-picker-context";
import { byUse, searchFoods, useFoods } from "@/lib/hooks/use-foods";
import { useProfile } from "@/lib/hooks/use-profile";
import { addLog } from "@/lib/repo/food-logs";
import { formatCalories, formatMacro } from "@/lib/nutrition";
import { recordUse, toggleFavorite } from "@/lib/repo/foods";
import { MEAL_LABELS } from "@/lib/constants";
import { useTemplates } from "@/lib/hooks/use-templates";
import { applyTemplate, templateMacros } from "@/lib/repo/meal-templates";
import type { Food } from "@/types";

const TABS = ["Recent", "Favorites", "My Foods", "Meals", "AI"] as const;
type Tab = (typeof TABS)[number];

export function AddFoodSheet() {
  const { user } = useAuth();
  const { open, meal, date, closePicker } = useFoodPicker();
  const { foods, loading } = useFoods(user?.uid ?? null);
  const { targets } = useProfile(user?.uid ?? null);
  const { templates } = useTemplates(user?.uid ?? null);

  const [tab, setTab] = useState<Tab>("Recent");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const matched = searchFoods(foods, term);
    if (tab === "Favorites") {
      return matched.filter((f) => f.isFavorite).sort(byName);
    }
    if (tab === "My Foods") return [...matched].sort(byName);
    // Recent: what actually gets eaten, most-used first.
    return [...matched].sort(byUse);
  }, [foods, term, tab]);

  async function handleConfirm(quantity: number) {
    if (!user || !selected) return;
    setSaving(true);
    setError(null);
    try {
      await addLog(
        user.uid,
        selected,
        { foodId: selected.id, logDate: date, mealCategory: meal, quantity },
        targets,
      );
      // Keeps the Recent tab ordered by real use.
      void recordUse(selected.id);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(12);
      }
      setSelected(null);
      setTerm("");
      closePicker();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that food.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyTemplate(templateId: string) {
    if (!user) return;
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setSaving(true);
    setError(null);
    try {
      const { missing } = await applyTemplate(
        user.uid,
        template,
        foods,
        date,
        meal,
        targets,
      );
      if (missing > 0) {
        setError(
          `${missing} ingredient${missing === 1 ? "" : "s"} skipped — no longer in your database.`,
        );
      } else {
        closePicker();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet
        open={open && !selected}
        onClose={closePicker}
        fullHeight
        label="Add food"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pb-3 pt-1">
            <p className="label-metric mb-3">Add to {MEAL_LABELS[meal]}</p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search your foods"
                className="input h-12 w-full pl-10 pr-3 text-[15px]"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="mt-3 flex gap-5 border-b border-white/[0.06]">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`relative pb-2.5 text-[13px] font-[550] transition-colors ${
                    tab === t ? "text-blue" : "text-muted"
                  }`}
                >
                  {t}
                  {tab === t ? (
                    <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-blue" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
            {tab === "AI" ? (
              <Empty
                icon={<Sparkles className="h-5 w-5 text-muted" />}
                title="AI search arrives in Phase 9"
                body="Photograph a nutrition label or describe a food, and Claude fills in the macros for you to review."
              />
            ) : tab === "Meals" ? (
              templates.length === 0 ? (
                <Empty
                  title="No meal templates yet"
                  body="Save a meal you eat often from the Today screen, or load the starters under Settings › Meal templates."
                />
              ) : (
                <div className="space-y-2 pt-3">
                  {templates.map((t) => {
                    const m = templateMacros(t, foods);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={saving || t.items.length === 0}
                        onClick={() => void handleApplyTemplate(t.id)}
                        className="pressable flex w-full items-center justify-between gap-3 rounded-[12px] border border-white/[0.06] bg-surface/60 px-4 py-3 text-left disabled:opacity-40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-[600] text-foreground">
                            {t.name}
                          </span>
                          <span className="metric mt-0.5 block text-[12px] text-secondary">
                            {formatCalories(m.calories)} kcal ·{" "}
                            {formatMacro(m.protein)}g P · {t.items.length}{" "}
                            item{t.items.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        <Check className="h-4 w-4 shrink-0 text-blue" />
                      </button>
                    );
                  })}
                </div>
              )
            ) : loading ? (
              <p className="pt-8 text-center text-[13px] text-muted">Loading…</p>
            ) : visible.length === 0 ? (
              <div>
                <Empty
                  title={term ? "No matches" : "No foods yet"}
                  body={
                    term
                      ? "Nothing in your database matches that."
                      : "Load the starter foods from Settings, then everything you eat regularly is one tap away."
                  }
                />
                {term ? (
                  <Link
                    href={`/foods/search?q=${encodeURIComponent(term)}`}
                    onClick={closePicker}
                    className="btn-secondary pressable mx-auto mt-4 flex h-11 w-full max-w-xs items-center justify-center gap-2 text-[14px] font-[600]"
                  >
                    <Database className="h-4 w-4" />
                    Search USDA for &ldquo;{term}&rdquo;
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 pt-3">
                {visible.map((food) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    onSelect={setSelected}
                    onToggleFavorite={(f) =>
                      void toggleFavorite(f.id, !f.isFavorite)
                    }
                  />
                ))}
              </div>
            )}

            {error ? (
              <p className="mt-3 text-center text-[13px] text-danger">{error}</p>
            ) : null}
          </div>
        </div>
      </Sheet>

      <QuantitySheet
        key={selected?.id ?? "none"}
        food={selected}
        meal={meal}
        open={Boolean(selected)}
        busy={saving}
        onClose={() => setSelected(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

function Empty({
  icon,
  title,
  body,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center px-8 pt-14 text-center">
      {icon ? <div className="mb-3">{icon}</div> : null}
      <p className="text-[15px] font-[600] text-foreground">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function byName(a: Food, b: Food) {
  return a.name.localeCompare(b.name);
}
