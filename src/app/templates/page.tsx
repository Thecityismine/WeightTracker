"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { useFoods, searchFoods, byUse } from "@/lib/hooks/use-foods";
import { useProfile } from "@/lib/hooks/use-profile";
import { useTemplates } from "@/lib/hooks/use-templates";
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  templateMacros,
  updateTemplate,
  type TemplateDoc,
  type TemplateItem,
} from "@/lib/repo/meal-templates";
import { STARTER_TEMPLATES } from "@/data/starter-templates";
import { formatCalories, formatMacro } from "@/lib/nutrition";
import { MEAL_CATEGORIES, MEAL_LABELS, type MealCategory } from "@/lib/constants";
import { todayKey } from "@/lib/dates";
import type { Food } from "@/types";

export default function TemplatesPage() {
  const { user } = useAuth();
  const { templates, loading } = useTemplates(user?.uid ?? null);
  const { foods } = useFoods(user?.uid ?? null);
  const { targets } = useProfile(user?.uid ?? null);

  const [editing, setEditing] = useState<TemplateDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleLoadStarters() {
    if (!user) return;
    setBusy(true);
    setNotice(null);
    try {
      const existing = new Set(templates.map((t) => t.name));
      let created = 0;
      let skippedForFoods = 0;

      for (const starter of STARTER_TEMPLATES) {
        if (existing.has(starter.name)) continue;

        const items: TemplateItem[] = [];
        let missing = false;
        for (const item of starter.items) {
          const food = foods.find((f) => f.name === item.foodName);
          if (!food) {
            missing = true;
            break;
          }
          items.push({ foodId: food.id, quantity: item.quantity });
        }

        // A template missing an ingredient would log an incomplete meal.
        // Better to skip it and say so.
        if (missing || items.length === 0) {
          skippedForFoods++;
          continue;
        }

        await createTemplate(
          user.uid,
          starter.name,
          starter.meal,
          items,
          starter.servingsPrepared ?? 1,
        );
        created++;
      }

      setNotice(
        created === 0 && skippedForFoods === 0
          ? "All starter templates are already here."
          : `Added ${created} template${created === 1 ? "" : "s"}.` +
              (skippedForFoods
                ? ` Skipped ${skippedForFoods} — load the starter foods first.`
                : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleApply(
    template: TemplateDoc,
    meal: MealCategory,
    portions: number,
  ) {
    if (!user) return;
    setBusy(true);
    setNotice(null);
    try {
      const { added, missing } = await applyTemplate(
        user.uid,
        template,
        foods,
        todayKey(),
        meal,
        targets,
        portions,
      );
      const servings = template.servingsPrepared ?? 1;
      const portionNote =
        servings > 1 ? ` at ${formatQty(portions)} of ${servings} portions` : "";
      setNotice(
        `Added ${added} food${added === 1 ? "" : "s"} to ${MEAL_LABELS[meal]}${portionNote}.` +
          (missing
            ? ` ${missing} ingredient${missing === 1 ? " was" : "s were"} skipped — the food is no longer in your database.`
            : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBlank() {
    if (!user) return;
    const id = await createTemplate(user.uid, "New meal", "breakfast", [], 1);
    const created: TemplateDoc = {
      id,
      userId: user.uid,
      name: "New meal",
      defaultMealCategory: "breakfast",
      items: [],
      servingsPrepared: 1,
      createdAt: new Date().toISOString(),
    };
    setEditing(created);
  }

  return (
    <main className="mx-auto max-w-lg lg:max-w-4xl">
      <header className="px-4 pb-1 pt-8">
        <Link
          href="/settings"
          className="mb-2 flex items-center gap-1 text-[13px] text-muted"
        >
          <ChevronLeft className="h-4 w-4" />
          Settings
        </Link>
      </header>
      <PageHeader
        title="Meal templates"
        subtitle="Log a whole meal in one tap"
      />

      <div className="space-y-4 px-4 pb-10 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <button
          type="button"
          onClick={() => void handleCreateBlank()}
          disabled={busy}
          className="btn-primary pressable flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New template
        </button>

        {notice ? (
          <p className="rounded-[12px] border border-white/[0.06] bg-surface/50 px-4 py-2.5 text-[12px] leading-relaxed text-secondary">
            {notice}
          </p>
        ) : null}

        {loading ? (
          <p className="pt-6 text-center text-[13px] text-muted">Loading…</p>
        ) : templates.length === 0 ? (
          <Card className="px-5 py-5">
            <p className="text-[14px] text-foreground">No templates yet.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              A template saves a combination you eat often — the regular shake,
              a workday lunch — so logging it takes one tap instead of six.
            </p>
            <button
              type="button"
              onClick={() => void handleLoadStarters()}
              disabled={busy}
              className="btn-secondary pressable mt-4 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load starter templates
            </button>
          </Card>
        ) : (
          templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              foods={foods}
              busy={busy}
              onApply={handleApply}
              onEdit={() => setEditing(t)}
            />
          ))
        )}

        {templates.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleLoadStarters()}
            disabled={busy}
            className="btn-secondary pressable flex h-11 w-full items-center justify-center text-[13px] font-[600] disabled:opacity-60"
          >
            Load starter templates
          </button>
        ) : null}
      </div>

      <TemplateEditor
        key={editing?.id ?? "none"}
        template={editing}
        foods={foods}
        onClose={() => setEditing(null)}
      />
    </main>
  );
}

function TemplateCard({
  template,
  foods,
  busy,
  onApply,
  onEdit,
}: {
  template: TemplateDoc;
  foods: Food[];
  busy: boolean;
  onApply: (
    t: TemplateDoc,
    meal: MealCategory,
    portions: number,
  ) => Promise<void>;
  onEdit: () => void;
}) {
  const [meal, setMeal] = useState<MealCategory>(template.defaultMealCategory);
  const [portions, setPortions] = useState(1);

  const servings = template.servingsPrepared ?? 1;
  const isRecipe = servings > 1;

  // Per portion is the number that matters when eating; the batch total is
  // what you check while cooking.
  const macros = templateMacros(template, foods, true);

  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-[650] text-foreground">
            {template.name}
          </p>
          <p className="metric mt-0.5 text-[13px] text-secondary">
            {formatCalories(macros.calories)} kcal
            <span className="text-protein">
              {"  "}
              {formatMacro(macros.protein)}g P
            </span>
            <span className="text-fat">
              {"  "}
              {formatMacro(macros.fat)}g F
            </span>
            {isRecipe ? (
              <span className="text-muted">{"  "}per portion</span>
            ) : null}
          </p>
          {isRecipe ? (
            <p className="mt-0.5 text-[11px] text-muted">
              Recipe makes {servings} portions
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-[13px] text-blue"
        >
          Edit
        </button>
      </div>

      <ul className="mt-3 space-y-1">
        {template.items.map((item, i) => {
          const food = foods.find((f) => f.id === item.foodId);
          return (
            <li
              key={`${item.foodId}-${i}`}
              className="flex items-baseline justify-between gap-3 text-[13px]"
            >
              <span className="truncate text-secondary">
                {food ? food.name : "Removed food"}
              </span>
              <span className="metric shrink-0 text-muted">
                {formatQty(isRecipe ? item.quantity / servings : item.quantity)}{" "}
                × {food ? food.servingDescription : "—"}
              </span>
            </li>
          );
        })}
        {template.items.length === 0 ? (
          <li className="text-[13px] text-muted">No ingredients yet.</li>
        ) : null}
      </ul>

      {isRecipe ? (
        <div className="mt-3">
          <label className="label-metric mb-1.5 block">Portions eaten</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Fewer portions"
              onClick={() => setPortions((p) => Math.max(0.25, round4(p - 0.25)))}
              className="btn-secondary pressable flex h-10 w-10 items-center justify-center rounded-full"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="metric w-12 text-center text-[16px] font-[650] text-foreground">
              {formatQty(portions)}
            </span>
            <button
              type="button"
              aria-label="More portions"
              onClick={() =>
                setPortions((p) => Math.min(servings, round4(p + 0.25)))
              }
              className="btn-secondary pressable flex h-10 w-10 items-center justify-center rounded-full"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px] text-muted">of {servings}</span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value as MealCategory)}
          aria-label="Meal"
          className="input h-11 shrink-0 px-2 text-[13px]"
        >
          {MEAL_CATEGORIES.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void onApply(template, meal, portions)}
          disabled={busy || template.items.length === 0}
          className="btn-primary pressable flex h-11 flex-1 items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Add to today
        </button>
      </div>
    </Card>
  );
}

/** Rename, re-categorize, adjust quantities, add and remove ingredients. */
function TemplateEditor({
  template,
  foods,
  onClose,
}: {
  template: TemplateDoc | null;
  foods: Food[];
  onClose: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [meal, setMeal] = useState<MealCategory>(
    template?.defaultMealCategory ?? "breakfast",
  );
  const [items, setItems] = useState<TemplateItem[]>(template?.items ?? []);
  const [servings, setServings] = useState(template?.servingsPrepared ?? 1);
  const [term, setTerm] = useState("");
  const [saving, setSaving] = useState(false);

  const candidates = useMemo(
    () => [...searchFoods(foods, term)].sort(byUse).slice(0, 40),
    [foods, term],
  );

  if (!template) {
    return (
      <Sheet open={false} onClose={onClose} label="Edit template">
        {null}
      </Sheet>
    );
  }

  const setQty = (i: number, q: number) =>
    setItems((list) =>
      list.map((item, idx) =>
        idx === i ? { ...item, quantity: Math.max(0.5, round2(q)) } : item,
      ),
    );

  async function handleSave() {
    setSaving(true);
    try {
      await updateTemplate(template!.id, {
        name: name.trim() || "Untitled meal",
        defaultMealCategory: meal,
        items,
        servingsPrepared: Math.max(1, Math.round(servings)),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteTemplate(template!.id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} fullHeight label="Edit template">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-5 pb-3 pt-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="input h-11 w-full px-3.5 text-[15px] font-[600]"
          />
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value as MealCategory)}
            aria-label="Default meal"
            className="input mt-2 h-10 w-full px-3 text-[13px]"
          >
            {MEAL_CATEGORIES.map((m) => (
              <option key={m} value={m}>
                Default: {MEAL_LABELS[m]}
              </option>
            ))}
          </select>

          {/*
            The recipe control. Above 1, the ingredient quantities below
            describe the whole batch and logging a portion divides by this —
            which is what lets one tablespoon of oil cook four bowls.
          */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[13px] text-secondary">
              Portions this makes
            </span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Fewer portions"
                onClick={() => setServings((v) => Math.max(1, v - 1))}
                className="btn-secondary pressable flex h-9 w-9 items-center justify-center rounded-full"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="metric w-8 text-center text-[15px] font-[650] text-foreground">
                {servings}
              </span>
              <button
                type="button"
                aria-label="More portions"
                onClick={() => setServings((v) => Math.min(20, v + 1))}
                className="btn-secondary pressable flex h-9 w-9 items-center justify-center rounded-full"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            {servings > 1
              ? `Enter quantities for the whole batch. Logging one portion records a ${fractionLabel(servings)} of each ingredient — including the cooking oil.`
              : "Leave at 1 when the quantities below are already one serving."}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <SectionLabel>
            {servings > 1 ? "Ingredients (whole batch)" : "Ingredients"}
          </SectionLabel>
          <div className="mt-2 space-y-1.5">
            {items.map((item, i) => {
              const food = foods.find((f) => f.id === item.foodId);
              return (
                <div
                  key={`${item.foodId}-${i}`}
                  className="flex items-center gap-2 rounded-[12px] border border-white/[0.06] bg-surface/50 px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">
                      {food?.name ?? "Removed food"}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {food?.servingDescription ?? "—"}
                    </span>
                  </span>

                  <button
                    type="button"
                    aria-label="Less"
                    onClick={() => setQty(i, item.quantity - 0.5)}
                    className="btn-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="metric w-9 shrink-0 text-center text-[14px] font-[650] text-foreground">
                    {formatQty(item.quantity)}
                  </span>
                  <button
                    type="button"
                    aria-label="More"
                    onClick={() => setQty(i, item.quantity + 0.5)}
                    className="btn-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() =>
                      setItems((list) => list.filter((_, idx) => idx !== i))
                    }
                    className="flex h-9 w-8 shrink-0 items-center justify-center text-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {items.length === 0 ? (
              <p className="text-[13px] text-muted">
                Add ingredients from the list below.
              </p>
            ) : null}
          </div>

          <div className="mt-5">
            <SectionLabel>Add an ingredient</SectionLabel>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search foods"
                className="input h-11 w-full pl-9 pr-3 text-[14px]"
              />
            </div>

            <div className="mt-2 space-y-1 pb-4">
              {candidates.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setItems((list) => [
                      ...list,
                      { foodId: f.id, quantity: 1 },
                    ])
                  }
                  className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-foreground">
                      {f.name}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {f.servingDescription}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-blue" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-2 px-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary pressable flex h-12 w-full items-center justify-center gap-2 text-[15px] font-[600] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save template
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving}
            className="btn-destructive pressable flex h-10 w-full items-center justify-center gap-2 text-[13px] font-[600] disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete template
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

function round2(n: number): number {
  return Math.round(n * 2) / 2;
}

function fractionLabel(servings: number): string {
  if (servings === 2) return "half";
  if (servings === 3) return "third";
  if (servings === 4) return "quarter";
  return `1/${servings}`;
}

/** Quarter steps — a quarter tablespoon of oil is a real portion. */
function round4(n: number): number {
  return Math.round(n * 4) / 4;
}
