"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { NumberField } from "@/components/ui/number-field";
import { EstimateWarning } from "./verification-badge";
import { useAuth } from "@/lib/auth-context";
import { createFood, updateFood } from "@/lib/repo/foods";
import { uploadLabelImage } from "@/lib/repo/storage";
import { foodInputSchema, type FoodInput } from "@/lib/schemas";
import { formatCalories, formatMacro } from "@/lib/nutrition";
import type { Food } from "@/types";

const CATEGORIES: FoodInput["category"][] = [
  "protein",
  "carb",
  "fat",
  "dairy",
  "fruit",
  "vegetable",
  "supplement",
  "snack",
  "beverage",
  "condiment",
  "mixed",
];

export function blankFood(): FoodInput {
  return {
    name: "",
    brand: null,
    category: "protein",
    servingDescription: "",
    servingAmount: 1,
    servingUnit: "serving",
    servingWeightGrams: null,
    caloriesPerServing: 0,
    proteinPerServing: 0,
    fatPerServing: 0,
    carbsPerServing: 0,
    fiberPerServing: 0,
    sugarPerServing: null,
    saturatedFatPerServing: null,
    cholesterolMgPerServing: null,
    sodiumMgPerServing: null,
    potassiumMgPerServing: null,
    dataSource: "manual",
    externalFoodId: null,
    verificationStatus: "user_entered",
    confidenceScore: null,
    labelImageUrl: null,
    isFavorite: false,
    isActive: true,
  };
}

export function toInput(food: Food): FoodInput {
  return {
    name: food.name,
    brand: food.brand,
    category: food.category,
    servingDescription: food.servingDescription,
    servingAmount: food.servingAmount,
    servingUnit: food.servingUnit,
    servingWeightGrams: food.servingWeightGrams,
    caloriesPerServing: food.caloriesPerServing,
    proteinPerServing: food.proteinPerServing,
    fatPerServing: food.fatPerServing,
    carbsPerServing: food.carbsPerServing,
    fiberPerServing: food.fiberPerServing,
    sugarPerServing: food.sugarPerServing ?? null,
    saturatedFatPerServing: food.saturatedFatPerServing ?? null,
    cholesterolMgPerServing: food.cholesterolMgPerServing ?? null,
    sodiumMgPerServing: food.sodiumMgPerServing ?? null,
    potassiumMgPerServing: food.potassiumMgPerServing ?? null,
    dataSource: food.dataSource,
    externalFoodId: food.externalFoodId,
    verificationStatus: food.verificationStatus,
    confidenceScore: food.confidenceScore,
    labelImageUrl: food.labelImageUrl,
    isFavorite: food.isFavorite,
    isActive: food.isActive,
  };
}

export function FoodForm({
  initial,
  foodId,
}: {
  initial: FoodInput;
  /** Present when editing an existing food. */
  foodId?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();

  const [edits, setEdits] = useState<Partial<FoodInput>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft: FoodInput = { ...initial, ...edits };
  const set = <K extends keyof FoodInput>(k: K, v: FoodInput[K]) =>
    setEdits((e) => ({ ...e, [k]: v }));

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError(null);

    const parsed = foodInputSchema.safeParse(draft);
    if (!parsed.success) {
      // Surface the first real problem rather than a wall of messages.
      setError(parsed.error.issues[0]?.message ?? "Check the fields above.");
      setSaving(false);
      return;
    }

    try {
      if (foodId) {
        await updateFood(foodId, parsed.data);
      } else {
        await createFood(user.uid, parsed.data);
      }
      router.push("/foods");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that food.");
      setSaving(false);
    }
  }

  async function handlePhoto(file: File) {
    if (!user) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadLabelImage(user.uid, file);
      set("labelImageUrl", url);
      // A photographed label is the highest-quality source there is.
      set("dataSource", "nutrition_label");
      set("verificationStatus", "label_verified");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5 px-4 pb-10">
      {/* ------------------------------------------------------ identity */}
      <Card className="px-5 py-4">
        <SectionLabel>Food</SectionLabel>

        <Field label="Name" htmlFor="name">
          <input
            id="name"
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="EB Egg"
            className="input h-11 w-full px-3.5 text-[15px]"
          />
        </Field>

        <Field label="Brand (optional)" htmlFor="brand">
          <input
            id="brand"
            value={draft.brand ?? ""}
            onChange={(e) => set("brand", e.target.value || null)}
            placeholder="Eggland's Best"
            className="input h-11 w-full px-3.5 text-[15px]"
          />
        </Field>

        <Field label="Category" htmlFor="category">
          <select
            id="category"
            value={draft.category}
            onChange={(e) =>
              set("category", e.target.value as FoodInput["category"])
            }
            className="input h-11 w-full px-3 text-[15px] capitalize"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {/* ------------------------------------------------------- serving */}
      <Card className="px-5 py-4">
        <SectionLabel>One serving</SectionLabel>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          Enter the numbers for a <strong>single serving</strong> exactly as the
          label states them. Everything else is multiplied from here — never
          type a total.
        </p>

        <Field label="Serving description" htmlFor="sd">
          <input
            id="sd"
            value={draft.servingDescription}
            onChange={(e) => set("servingDescription", e.target.value)}
            placeholder="1 large egg"
            className="input h-11 w-full px-3.5 text-[15px]"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Amount" htmlFor="sa">
            <NumberField
              id="sa"
              step="0.25"
              value={draft.servingAmount}
              onChange={(v) => set("servingAmount", v)}
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Unit" htmlFor="su">
            <input
              id="su"
              value={draft.servingUnit}
              onChange={(e) => set("servingUnit", e.target.value)}
              placeholder="egg"
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Grams" htmlFor="sw">
            <NumberField
              id="sw"
              value={draft.servingWeightGrams}
              onChange={(v) => set("servingWeightGrams", v)}
              allowNull
              onNull={() => set("servingWeightGrams", null)}
              placeholder="50"
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
        </div>
        <p className="-mt-1 text-[11px] text-muted">
          Serving weight is optional, but without it this food cannot be logged
          by grams.
        </p>
      </Card>

      {/* -------------------------------------------------------- macros */}
      <Card className="px-5 py-4">
        <SectionLabel>Nutrition per serving</SectionLabel>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Calories" htmlFor="cal">
            <NumberField
              id="cal"
              value={draft.caloriesPerServing}
              onChange={(v) => set("caloriesPerServing", v)}
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Protein (g)" htmlFor="pro">
            <NumberField
              id="pro"
              step="0.1"
              value={draft.proteinPerServing}
              onChange={(v) => set("proteinPerServing", v)}
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Fat (g)" htmlFor="fat">
            <NumberField
              id="fat"
              step="0.1"
              value={draft.fatPerServing}
              onChange={(v) => set("fatPerServing", v)}
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Carbs (g)" htmlFor="carb">
            <NumberField
              id="carb"
              step="0.1"
              value={draft.carbsPerServing}
              onChange={(v) => set("carbsPerServing", v)}
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Fiber (g)" htmlFor="fib">
            <NumberField
              id="fib"
              step="0.1"
              value={draft.fiberPerServing}
              onChange={(v) => set("fiberPerServing", v)}
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
        </div>

        <p className="label-metric mt-5">Also on the label</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          Optional. Leave blank when the label does not list it — blank means
          unknown, which is not the same as zero.
        </p>

        <div className="mt-1 grid grid-cols-2 gap-3">
          <Field label="Sugar (g)" htmlFor="sug">
            <NumberField
              id="sug"
              step="0.1"
              value={draft.sugarPerServing ?? null}
              onChange={(v) => set("sugarPerServing", v)}
              allowNull
              onNull={() => set("sugarPerServing", null)}
              placeholder="—"
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Saturated fat (g)" htmlFor="sat">
            <NumberField
              id="sat"
              step="0.1"
              value={draft.saturatedFatPerServing ?? null}
              onChange={(v) => set("saturatedFatPerServing", v)}
              allowNull
              onNull={() => set("saturatedFatPerServing", null)}
              placeholder="—"
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          {/* Labels print these two in milligrams, so the field says so. */}
          <Field label="Cholesterol (mg)" htmlFor="chol">
            <NumberField
              id="chol"
              value={draft.cholesterolMgPerServing ?? null}
              onChange={(v) => set("cholesterolMgPerServing", v)}
              allowNull
              onNull={() => set("cholesterolMgPerServing", null)}
              placeholder="—"
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Sodium (mg)" htmlFor="sod">
            <NumberField
              id="sod"
              value={draft.sodiumMgPerServing ?? null}
              onChange={(v) => set("sodiumMgPerServing", v)}
              allowNull
              onNull={() => set("sodiumMgPerServing", null)}
              placeholder="—"
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
          <Field label="Potassium (mg)" htmlFor="pot">
            <NumberField
              id="pot"
              value={draft.potassiumMgPerServing ?? null}
              onChange={(v) => set("potassiumMgPerServing", v)}
              allowNull
              onNull={() => set("potassiumMgPerServing", null)}
              placeholder="—"
              className="input h-11 w-full px-3 text-[15px]"
            />
          </Field>
        </div>

        {/* Live preview — what one serving will actually count as. */}
        <div className="mt-3 rounded-[12px] border border-white/[0.06] bg-surface/50 px-4 py-3">
          <p className="text-[12px] text-muted">
            1 × {draft.servingDescription || "serving"} counts as
          </p>
          <p className="metric mt-1 text-[17px] font-[650] text-foreground">
            {formatCalories(draft.caloriesPerServing)} kcal
            <span className="text-protein">
              {"  "}
              {formatMacro(draft.proteinPerServing)}g P
            </span>
            <span className="text-fat">
              {"  "}
              {formatMacro(draft.fatPerServing)}g F
            </span>
          </p>
          {draft.sodiumMgPerServing != null ||
          draft.potassiumMgPerServing != null ||
          draft.sugarPerServing != null ||
          draft.saturatedFatPerServing != null ||
          draft.cholesterolMgPerServing != null ? (
            <p className="metric mt-1 text-[12px] text-muted">
              {[
                draft.sugarPerServing != null
                  ? `${formatMacro(draft.sugarPerServing)}g sugar`
                  : null,
                draft.saturatedFatPerServing != null
                  ? `${formatMacro(draft.saturatedFatPerServing)}g sat fat`
                  : null,
                draft.cholesterolMgPerServing != null
                  ? `${formatMacro(draft.cholesterolMgPerServing)}mg chol`
                  : null,
                draft.sodiumMgPerServing != null
                  ? `${formatMacro(draft.sodiumMgPerServing)}mg sodium`
                  : null,
                draft.potassiumMgPerServing != null
                  ? `${formatMacro(draft.potassiumMgPerServing)}mg potassium`
                  : null,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          ) : null}
        </div>

        {draft.verificationStatus === "ai_estimated" ? (
          <EstimateWarning />
        ) : null}
      </Card>

      {/* --------------------------------------------------------- label */}
      <Card className="px-5 py-4">
        <SectionLabel>Label photo</SectionLabel>

        {draft.labelImageUrl ? (
          <div className="mt-3">
            <div className="relative h-44 w-full overflow-hidden rounded-[12px] border border-white/[0.06]">
              <Image
                src={draft.labelImageUrl}
                alt="Nutrition label"
                fill
                sizes="(max-width: 512px) 100vw, 512px"
                className="object-contain"
                unoptimized
              />
            </div>
            <button
              type="button"
              onClick={() => set("labelImageUrl", null)}
              className="btn-secondary pressable mt-2 flex h-10 w-full items-center justify-center gap-2 text-[13px]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove photo
            </button>
          </div>
        ) : (
          <label className="btn-secondary pressable mt-3 flex h-11 w-full cursor-pointer items-center justify-center gap-2 text-[14px] font-[600]">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {uploading ? "Uploading…" : "Add label photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePhoto(f);
              }}
            />
          </label>
        )}

        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          A photo of the package marks this food label-verified. Reading the
          macros off the photo automatically arrives in Phase 9.
        </p>
      </Card>

      {/* --------------------------------------------------------- flags */}
      <Card className="px-5 py-4">
        <label className="flex items-center justify-between py-1">
          <span className="text-[14px] text-secondary">Favorite</span>
          <input
            type="checkbox"
            checked={draft.isFavorite}
            onChange={(e) => set("isFavorite", e.target.checked)}
            className="h-6 w-6 accent-[var(--blue)]"
          />
        </label>
      </Card>

      {error ? (
        <p className="text-center text-[13px] text-danger">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving || uploading}
        className="btn-primary pressable flex h-12 w-full items-center justify-center gap-2 text-[15px] font-[600] disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {foodId ? "Save changes" : "Add food"}
      </button>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <label className="label-metric mb-2 block" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
