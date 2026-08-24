"use client";

import { useState } from "react";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { EstimateWarning } from "@/components/foods/verification-badge";
import { NumberField } from "@/components/ui/number-field";
import { useAuth } from "@/lib/auth-context";
import { createFood } from "@/lib/repo/foods";
import { logAiSearch } from "@/lib/repo/ai-searches";
import { downscaleImage } from "@/lib/image";
import { formatCalories, formatMacro } from "@/lib/nutrition";
import type { AiFood } from "@/lib/ai/schemas";
import type { FoodInput } from "@/lib/schemas";
import type { Food } from "@/types";

const CONFIDENCE_COLOR: Record<AiFood["confidence"], string> = {
  high: "var(--success)",
  medium: "var(--blue)",
  low: "var(--warning)",
};

/**
 * AI food entry.
 *
 * The review step is mandatory. Claude proposes; nothing reaches the database
 * until the numbers have been looked at, and every field stays editable.
 */
export function AiSearch({ onSaved }: { onSaved: (food: Food) => void }) {
  const { user, getToken } = useAuth();

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<"lookup" | "scan" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<AiFood | null>(null);
  const [fromLabel, setFromLabel] = useState(false);
  const [edits, setEdits] = useState<Partial<AiFood>>({});

  const draft = result ? { ...result, ...edits } : null;
  const set = <K extends keyof AiFood>(k: K, v: AiFood[K]) =>
    setEdits((e) => ({ ...e, [k]: v }));

  async function post<T>(path: string, body: unknown): Promise<T> {
    const token = await getToken();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Request failed.");
    return json as T;
  }

  async function handleLookup() {
    if (query.trim().length < 3) return;
    setBusy("lookup");
    setError(null);
    setEdits({});
    try {
      const { food } = await post<{ food: AiFood }>("/api/ai/lookup", {
        query: query.trim(),
      });
      setResult(food);
      setFromLabel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePhoto(file: File) {
    setBusy("scan");
    setError(null);
    setEdits({});
    try {
      const { base64, mediaType } = await downscaleImage(file);
      const { food } = await post<{ food: AiFood }>("/api/ai/label-scan", {
        imageBase64: base64,
        mediaType,
      });
      setResult(food);
      setFromLabel(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that label.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!user || !draft) return;
    setBusy("save");
    setError(null);
    try {
      // A photographed label is a real source; a description is an estimate.
      // That distinction drives the badge and the warning strip, so it must
      // never be flattened.
      const input: FoodInput = {
        name: draft.name,
        brand: draft.brand,
        category: "mixed",
        servingDescription: draft.servingDescription,
        servingAmount: 1,
        servingUnit: draft.servingDescription,
        servingWeightGrams: draft.servingWeightGrams,
        caloriesPerServing: draft.caloriesPerServing,
        proteinPerServing: draft.proteinPerServing,
        fatPerServing: draft.fatPerServing,
        carbsPerServing: draft.carbsPerServing,
        fiberPerServing: draft.fiberPerServing,
        sugarPerServing: draft.sugarPerServing,
        saturatedFatPerServing: draft.saturatedFatPerServing,
        cholesterolMgPerServing: draft.cholesterolMgPerServing,
        sodiumMgPerServing: draft.sodiumMgPerServing,
        potassiumMgPerServing: draft.potassiumMgPerServing,
        dataSource: fromLabel ? "nutrition_label" : "ai_estimate",
        externalFoodId: null,
        verificationStatus: fromLabel ? "label_verified" : "ai_estimated",
        confidenceScore:
          draft.confidence === "high" ? 0.9 : draft.confidence === "medium" ? 0.6 : 0.3,
        labelImageUrl: null,
        isFavorite: false,
        isActive: true,
      };

      const id = await createFood(user.uid, input);

      void logAiSearch(user.uid, {
        searchQuery: fromLabel ? null : query.trim(),
        suggestedResult: JSON.stringify(draft),
        dataSource: input.dataSource,
        confidenceScore: input.confidenceScore,
        approved: true,
      });

      onSaved({ id, ...input, useCount: 0, lastUsedAt: null } as Food);
      setResult(null);
      setQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that food.");
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------------------------------- review step */
  if (draft) {
    return (
      <div className="pt-3">
        <div className="rounded-[12px] border border-white/[0.06] bg-surface/60 px-4 py-4">
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="input h-11 w-full px-3 text-[15px] font-[600]"
            aria-label="Food name"
          />

          <label className="label-metric mb-1.5 mt-3 block">Serving</label>
          <input
            value={draft.servingDescription}
            onChange={(e) => set("servingDescription", e.target.value)}
            className="input h-11 w-full px-3 text-[14px]"
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Macro label="Calories" value={draft.caloriesPerServing} onChange={(v) => set("caloriesPerServing", v)} />
            <Macro label="Protein (g)" value={draft.proteinPerServing} onChange={(v) => set("proteinPerServing", v)} step="0.1" />
            <Macro label="Fat (g)" value={draft.fatPerServing} onChange={(v) => set("fatPerServing", v)} step="0.1" />
            <Macro label="Carbs (g)" value={draft.carbsPerServing} onChange={(v) => set("carbsPerServing", v)} step="0.1" />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: CONFIDENCE_COLOR[draft.confidence] }}
            />
            <span className="text-[11px] text-muted">
              {fromLabel ? "Read from label" : "AI estimate"} · confidence{" "}
              {draft.confidence}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            {draft.notes}
          </p>

          {/* The model was unsure about portion size — say so loudly. */}
          {draft.needsClarification && draft.clarifyingQuestion ? (
            <div
              className="mt-3 rounded-[12px] border px-3.5 py-2.5"
              style={{
                borderColor: "rgba(255,181,71,0.28)",
                background: "rgba(255,181,71,0.07)",
              }}
            >
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--warning)" }}>
                {draft.clarifyingQuestion}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Answer by editing the serving above, or search again with more
                detail.
              </p>
            </div>
          ) : null}

          {!fromLabel ? <EstimateWarning /> : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setEdits({});
              }}
              className="btn-secondary pressable h-11 flex-1 text-[14px] font-[600]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy === "save"}
              className="btn-primary pressable flex h-11 flex-1 items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save food
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-[13px] text-danger">{error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------- entry step */
  return (
    <div className="pt-4">
      <div className="flex flex-col items-center px-6 text-center">
        <Sparkles className="mb-2 h-5 w-5 text-blue" />
        <p className="text-[15px] font-[600] text-foreground">
          Nutrition assistant
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Describe a food or photograph its label. You review everything before
          it is saved.
        </p>
      </div>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={2}
        placeholder="Medium grilled pork chop, about 5 oz cooked"
        className="input mt-4 w-full resize-none px-3.5 py-3 text-[15px]"
      />

      <div className="mt-2 flex gap-2">
        <label className="btn-secondary pressable flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 text-[14px] font-[600]">
          {busy === "scan" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {busy === "scan" ? "Reading…" : "Scan label"}
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

        <button
          type="button"
          onClick={() => void handleLookup()}
          disabled={busy !== null || query.trim().length < 3}
          className="btn-primary pressable flex h-11 flex-1 items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-50"
        >
          {busy === "lookup" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Ask Claude
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-center text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <p className="mt-4 px-2 text-center text-[11px] leading-relaxed text-muted">
        A photographed label beats an estimate every time. Where you have the
        package, scan it.
      </p>
    </div>
  );
}

function Macro({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="label-metric mb-1.5 block">{label}</label>
      <NumberField
        value={value}
        onChange={onChange}
        step={step}
        ariaLabel={label}
        className="input h-11 w-full px-3 text-[15px]"
      />
    </div>
  );
}

/** Kept for the summary line under the review card. */
export function macroSummary(f: AiFood): string {
  return `${formatCalories(f.caloriesPerServing)} kcal · ${formatMacro(f.proteinPerServing)}g P · ${formatMacro(f.fatPerServing)}g F`;
}
