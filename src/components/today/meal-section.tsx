"use client";

import { useState } from "react";
import { BookmarkPlus, ChevronRight, CopyPlus, Plus, Trash2 } from "lucide-react";
import { ExtrasRow } from "./extras-row";
import { formatCalories, formatMacro, sumMacros } from "@/lib/nutrition";
import { MEAL_LABELS, type MealCategory } from "@/lib/constants";
import type { Food, FoodLog } from "@/types";

/**
 * A meal is a light list group, not a heavy container — thin divider under
 * the heading, totals aligned right, no card chrome.
 */
export function MealSection({
  meal,
  logs,
  isEvening,
  targetUnmet,
  onAdd,
  onEdit,
  onDelete,
  onCopyYesterday,
  onSaveAsMeal,
  foods,
  onQuickAdd,
}: {
  meal: MealCategory;
  logs: FoodLog[];
  isEvening: boolean;
  targetUnmet: boolean;
  onAdd: (meal: MealCategory) => void;
  onEdit: (log: FoodLog) => void;
  onDelete: (log: FoodLog) => void;
  onCopyYesterday: (meal: MealCategory) => void;
  onSaveAsMeal: (meal: MealCategory) => void;
  foods: Food[];
  onQuickAdd: (food: Food, meal: MealCategory) => void;
}) {
  // Collapsed by default. Five expanded meals push the calorie ring and the
  // macro cards — the numbers the dashboard exists to show — off the screen,
  // so a meal opens when it is asked for, not before.
  const [collapsed, setCollapsed] = useState(true);

  const totals = sumMacros(
    logs.map((l) => ({
      calories: l.caloriesSnapshot,
      protein: l.proteinSnapshot,
    })),
  );

  // An empty dinner late in the day, with the target still unmet, is the one
  // moment the app should nudge — amber, not red.
  const nudge = meal === "dinner" && logs.length === 0 && isEvening && targetUnmet;

  return (
    <section className="mt-7">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between pb-2"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-1.5">
          <span className="label-metric">{MEAL_LABELS[meal]}</span>
          <ChevronRight
            className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
              collapsed ? "" : "rotate-90"
            }`}
          />
        </span>

        {logs.length > 0 ? (
          <span className="metric text-[13px] text-secondary">
            {formatCalories(totals.calories)} kcal
            {collapsed ? (
              <span className="text-muted">
                {"  •  "}
                {formatMacro(totals.protein)}g protein
              </span>
            ) : null}
          </span>
        ) : null}
      </button>

      <div className="h-px w-full bg-white/[0.06]" />

      {!collapsed ? (
        <>
          {logs.map((log) => (
            <FoodRow
              key={log.id}
              log={log}
              onEdit={() => onEdit(log)}
              onDelete={() => onDelete(log)}
            />
          ))}

          <button
            type="button"
            onClick={() => onAdd(meal)}
            className="pressable mt-2.5 flex items-center gap-1.5 py-2 text-[13px] font-[550]"
            style={{ color: nudge ? "var(--warning)" : "var(--blue)" }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {logs.length === 0
              ? `Add ${MEAL_LABELS[meal].toLowerCase()}`
              : "Add food"}
          </button>

          <ExtrasRow foods={foods} onPick={(f) => onQuickAdd(f, meal)} />

          {/* Secondary actions stay quiet — muted, small, never blue, so the
              primary "Add food" keeps its emphasis. */}
          <div className="-mt-1 flex gap-4">
            <button
              type="button"
              onClick={() => onCopyYesterday(meal)}
              className="flex items-center gap-1 py-1.5 text-[12px] text-muted"
            >
              <CopyPlus className="h-3.5 w-3.5" />
              Copy yesterday
            </button>

            {logs.length > 0 ? (
              <button
                type="button"
                onClick={() => onSaveAsMeal(meal)}
                className="flex items-center gap-1 py-1.5 text-[12px] text-muted"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save as meal
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {/*
        Outside the collapse: an empty dinner late in an unmet day is the one
        thing the section has to say whether or not it is open, and now that
        meals start closed it would otherwise never be seen.
      */}
      {nudge ? (
        <p className="pt-2 text-[12px] text-muted">
          Still short of today&apos;s target — dinner is the easiest place to
          close the gap.
        </p>
      ) : null}
    </section>
  );
}

function FoodRow({
  log,
  onEdit,
  onDelete,
}: {
  log: FoodLog;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 border-b border-white/[0.03] py-3">
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] text-foreground">
            {log.nameSnapshot}
          </span>
          <span className="metric mt-0.5 block text-[12px] text-muted">
            {formatQuantity(log.quantity)} × {log.servingDescriptionSnapshot}
          </span>
        </span>

        <span className="metric shrink-0 text-right">
          <span className="block text-[14px] text-foreground">
            {formatCalories(log.caloriesSnapshot)} kcal
          </span>
          <span className="block text-[12px] text-protein">
            {formatMacro(log.proteinSnapshot)}g
          </span>
        </span>
      </button>

      <button
        type="button"
        aria-label={`Delete ${log.nameSnapshot}`}
        onClick={onDelete}
        className="flex h-11 w-9 shrink-0 items-center justify-center text-muted transition-colors hover:text-danger"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function formatQuantity(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
