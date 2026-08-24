"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { CalorieCard } from "@/components/today/calorie-card";
import { MacroCards } from "@/components/today/macro-cards";
import { MealSection } from "@/components/today/meal-section";
import { QuantitySheet } from "@/components/food-picker/quantity-sheet";
import { WeightSheet } from "@/components/weight/weight-sheet";
import { useAuth } from "@/lib/auth-context";
import { useFoodPicker } from "@/lib/food-picker-context";
import { useDayLogs } from "@/lib/hooks/use-day-logs";
import { useFoods } from "@/lib/hooks/use-foods";
import { useProfile } from "@/lib/hooks/use-profile";
import { useWeights } from "@/lib/hooks/use-weights";
import { useMounted } from "@/lib/use-mounted";
import { addLog, copyMeal, deleteLog, updateLogQuantity } from "@/lib/repo/food-logs";
import { recordUse } from "@/lib/repo/foods";
import { createTemplate } from "@/lib/repo/meal-templates";
import { carbTarget, formatWeight, sumMacros } from "@/lib/nutrition";
import { MEAL_CATEGORIES, MEAL_LABELS, type MealCategory } from "@/lib/constants";
import {
  daysSince,
  formatLongDate,
  shiftDateKey as shiftKey,
  isToday,
  shiftDateKey,
  todayKey,
  type DateKey,
} from "@/lib/dates";
import type { Food, FoodLog } from "@/types";

export default function TodayPage() {
  const { user } = useAuth();
  const mounted = useMounted();
  const { openPicker } = useFoodPicker();

  const [date, setDate] = useState<DateKey>(todayKey());
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [weighing, setWeighing] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{
    food: Food;
    meal: MealCategory;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { profile, targets } = useProfile(user?.uid ?? null);
  const { latest, average7, forDate } = useWeights(user?.uid ?? null);
  const { logs, loading } = useDayLogs(user?.uid ?? null, date);
  const { foods } = useFoods(user?.uid ?? null);

  const totals = sumMacros(
    logs.map((l) => ({
      calories: l.caloriesSnapshot,
      protein: l.proteinSnapshot,
      fat: l.fatSnapshot,
      carbs: l.carbsSnapshot,
    })),
  );

  const weightToday = forDate(date);
  const unit = profile?.weightUnit ?? "lb";

  const hour = mounted ? new Date().getHours() : 12;
  const isEvening = hour >= 17;
  const targetUnmet = totals.calories < targets.calories;

  async function handleDelete(log: FoodLog) {
    if (!user) return;
    await deleteLog(user.uid, log.id, log.logDate, targets);
  }

  async function handleQuickAdd(quantity: number) {
    if (!user || !quickAdd) return;
    await addLog(
      user.uid,
      quickAdd.food,
      {
        foodId: quickAdd.food.id,
        logDate: date,
        mealCategory: quickAdd.meal,
        quantity,
      },
      targets,
    );
    void recordUse(quickAdd.food.id);
    setQuickAdd(null);
  }

  async function handleCopyYesterday(meal: MealCategory) {
    if (!user) return;
    const n = await copyMeal(user.uid, shiftKey(date, -1), date, meal, targets);
    setToast(
      n === 0
        ? `Nothing was logged for ${MEAL_LABELS[meal].toLowerCase()} yesterday.`
        : `Copied ${n} food${n === 1 ? "" : "s"} from yesterday.`,
    );
  }

  async function handleSaveAsMeal(meal: MealCategory) {
    if (!user) return;
    const rows = logs.filter((l) => l.mealCategory === meal);
    if (rows.length === 0) return;

    await createTemplate(
      user.uid,
      `${MEAL_LABELS[meal]} — ${formatLongDate(date)}`,
      meal,
      rows.map((l) => ({ foodId: l.foodId, quantity: l.quantity })),
    );
    setToast(
      `Saved as a template. Rename it under Settings › Meal templates.`,
    );
  }

  async function handleEditConfirm(quantity: number) {
    if (!user || !editing) return;
    setSavingEdit(true);
    try {
      await updateLogQuantity(user.uid, editing.id, quantity, targets);
      setEditing(null);
    } finally {
      setSavingEdit(false);
    }
  }

  // The quantity sheet needs a Food shape; rebuild per-serving values from the
  // log's own snapshot so editing never pulls in a later label correction.
  const editingFood = editing
    ? {
        ...(foods.find((f) => f.id === editing.foodId) ?? {}),
        id: editing.foodId,
        name: editing.nameSnapshot,
        servingDescription: editing.servingDescriptionSnapshot,
        caloriesPerServing: editing.caloriesSnapshot / editing.quantity,
        proteinPerServing: editing.proteinSnapshot / editing.quantity,
        fatPerServing: editing.fatSnapshot / editing.quantity,
        carbsPerServing: editing.carbsSnapshot / editing.quantity,
        fiberPerServing: editing.fiberSnapshot / editing.quantity,
      }
    : null;

  return (
    <main className="mx-auto max-w-lg">
      <header className="px-5 pb-5 pt-9">
        <h1 className="text-[26px] font-[650] leading-tight tracking-tight text-foreground">
          {mounted ? greeting(hour) : " "}
        </h1>

        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setDate((d) => shiftDateKey(d, -1))}
            className="flex h-8 w-7 items-center justify-center text-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <p className="min-w-[170px] text-sm text-secondary">
            {isToday(date) ? "Today, " : ""}
            {formatLongDate(date)}
          </p>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => setDate((d) => shiftDateKey(d, 1))}
            disabled={isToday(date)}
            className="flex h-8 w-7 items-center justify-center text-muted disabled:opacity-25"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weight is the secondary metric — present, never competing with
            the calorie counter for attention. */}
        <button
          type="button"
          onClick={() => setWeighing(true)}
          className="pressable mt-3 flex items-center gap-2.5"
        >
          <span
            className="flex h-8 items-center gap-1.5 rounded-full border px-3"
            style={{
              borderColor: weightToday
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,181,71,0.35)",
              background: weightToday
                ? "var(--surface)"
                : "rgba(255,181,71,0.08)",
            }}
          >
            <Scale
              className="h-3.5 w-3.5"
              style={{
                color: weightToday ? "var(--text-muted)" : "var(--warning)",
              }}
            />
            <span
              className="metric text-[13px]"
              style={{
                color: weightToday ? "var(--text-primary)" : "var(--warning)",
              }}
            >
              {weightToday
                ? `${formatWeight(weightToday.weight)} ${unit}`
                : isToday(date)
                  ? "Log weight"
                  : "No weigh-in"}
            </span>
          </span>

          {average7 != null ? (
            <span className="metric text-[12px] text-muted">
              {formatWeight(average7)} {unit} avg
            </span>
          ) : null}

          {profile ? (
            <span className="metric text-[12px] text-muted">
              Day {daysSince(profile.startingDate)}
            </span>
          ) : null}
        </button>
      </header>

      <div className="px-4">
        <CalorieCard consumed={totals.calories} target={targets.calories} />

        <MacroCards
          protein={totals.protein}
          fat={totals.fat}
          carbs={totals.carbs}
          proteinTarget={targets.protein}
          fatTarget={targets.fat}
          carbTarget={carbTarget(targets)}
        />

        {loading && logs.length === 0 ? (
          <p className="pt-10 text-center text-[13px] text-muted">Loading…</p>
        ) : (
          MEAL_CATEGORIES.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              logs={logs.filter((l) => l.mealCategory === meal)}
              isEvening={isEvening}
              targetUnmet={targetUnmet}
              onAdd={(m) => openPicker(m, date)}
              onEdit={setEditing}
              onDelete={(log) => void handleDelete(log)}
              onCopyYesterday={(m) => void handleCopyYesterday(m)}
              onSaveAsMeal={(m) => void handleSaveAsMeal(m)}
              foods={foods}
              onQuickAdd={(f, m) => setQuickAdd({ food: f, meal: m })}
            />
          ))
        )}

        <div className="h-8" />
      </div>

      {toast ? (
        <button
          type="button"
          onClick={() => setToast(null)}
          className="fixed inset-x-4 bottom-[92px] z-30 mx-auto max-w-md rounded-[12px] border border-white/10 px-4 py-3 text-left text-[13px] text-foreground"
          style={{ background: "var(--surface-active)" }}
        >
          {toast}
        </button>
      ) : null}

      <QuantitySheet
        key={`qa-${quickAdd?.food.id ?? "none"}`}
        food={quickAdd?.food ?? null}
        meal={quickAdd?.meal ?? "breakfast"}
        open={Boolean(quickAdd)}
        initialQuantity={1}
        onClose={() => setQuickAdd(null)}
        onConfirm={(q) => void handleQuickAdd(q)}
      />

      <WeightSheet
        key={`w-${date}-${weightToday?.weight ?? "none"}`}
        open={weighing}
        date={date}
        existing={weightToday}
        suggested={
          weightToday?.weight ??
          latest?.weight ??
          profile?.startingWeight ??
          144
        }
        unit={unit}
        onClose={() => setWeighing(false)}
      />

      <QuantitySheet
        key={editing?.id ?? "none"}
        food={editingFood as never}
        meal={editing?.mealCategory ?? "breakfast"}
        open={Boolean(editing)}
        busy={savingEdit}
        initialQuantity={editing?.quantity ?? 1}
        submitLabel="Save quantity"
        onClose={() => setEditing(null)}
        onConfirm={(q) => void handleEditConfirm(q)}
      />
    </main>
  );
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning, Jorge";
  if (hour < 18) return "Good afternoon, Jorge";
  return "Good evening, Jorge";
}
