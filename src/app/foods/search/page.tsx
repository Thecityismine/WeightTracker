"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Database, Loader2, Search } from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { createFood } from "@/lib/repo/foods";
import { toFoodInput, type ServingOption, type UsdaFoodDetail, type UsdaSearchHit } from "@/lib/usda";
import { formatCalories, formatMacro } from "@/lib/nutrition";

export default function UsdaSearchPage() {
  const router = useRouter();
  const { user, getToken } = useAuth();

  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<UsdaSearchHit[] | null>(null);
  const [detail, setDetail] = useState<UsdaFoodDetail | null>(null);
  const [option, setOption] = useState<ServingOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Every USDA call goes through our server, which holds the API key. */
  async function call<T>(path: string): Promise<T> {
    const token = await getToken();
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? "Request failed.");
    return body as T;
  }

  async function handleSearch() {
    if (term.trim().length < 2) return;
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      const body = await call<{ results: UsdaSearchHit[] }>(
        `/api/usda/search?q=${encodeURIComponent(term.trim())}`,
      );
      setHits(body.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(hit: UsdaSearchHit) {
    setBusy(true);
    setError(null);
    try {
      const body = await call<{ food: UsdaFoodDetail }>(
        `/api/usda/food/${hit.fdcId}`,
      );
      setDetail(body.food);
      setOption(body.food.servingOptions[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!user || !detail || !option) return;
    setBusy(true);
    setError(null);

    const input = toFoodInput(detail, option);
    if (!input) {
      setError(
        "That record has no usable nutrition for the chosen serving. Pick another serving or enter it by hand.",
      );
      setBusy(false);
      return;
    }

    try {
      const id = await createFood(user.uid, input);
      router.push(`/foods/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that food.");
      setBusy(false);
    }
  }

  const preview =
    detail && option ? toFoodInput(detail, option) : null;

  return (
    <main className="mx-auto max-w-lg">
      <header className="px-4 pb-1 pt-8">
        <Link
          href="/foods"
          className="mb-2 flex items-center gap-1 text-[13px] text-muted"
        >
          <ChevronLeft className="h-4 w-4" />
          Foods
        </Link>
      </header>
      <PageHeader
        title="USDA search"
        subtitle="Find a food that is not in your database yet"
      />

      <div className="space-y-4 px-4 pb-10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSearch();
              }}
              placeholder="Grilled pork chop"
              className="input h-12 w-full pl-10 pr-3 text-[15px]"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={busy || term.trim().length < 2}
            className="btn-primary pressable flex h-12 shrink-0 items-center justify-center px-4 text-[14px] font-[600] disabled:opacity-50"
          >
            {busy && !detail ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>

        {error ? (
          <p className="text-[13px] leading-relaxed text-danger">{error}</p>
        ) : null}

        {/* --------------------------------------------- chosen record */}
        {detail ? (
          <Card className="px-5 py-4">
            <SectionLabel>Review before saving</SectionLabel>

            <p className="mt-2 text-[16px] font-[650] leading-tight text-foreground">
              {preview?.name ?? detail.name}
            </p>
            <p className="text-[12px] text-muted">
              {detail.brand ? `${detail.brand} · ` : ""}
              {detail.dataType} · FDC {detail.fdcId}
            </p>

            <div className="mt-4">
              <label className="label-metric mb-2 block" htmlFor="serving">
                Serving
              </label>
              <select
                id="serving"
                value={option?.description ?? ""}
                onChange={(e) =>
                  setOption(
                    detail.servingOptions.find(
                      (o) => o.description === e.target.value,
                    ) ?? null,
                  )
                }
                className="input h-11 w-full px-3 text-[14px]"
              >
                {detail.servingOptions.map((o) => (
                  <option key={`${o.description}-${o.grams}`} value={o.description}>
                    {o.description}
                    {o.grams ? ` (${o.grams} g)` : ""}
                  </option>
                ))}
              </select>
            </div>

            {preview ? (
              <div className="mt-3 rounded-[12px] border border-white/[0.06] bg-surface/50 px-4 py-3">
                <p className="text-[12px] text-muted">
                  1 × {preview.servingDescription} counts as
                </p>
                <p className="metric mt-1 text-[17px] font-[650] text-foreground">
                  {formatCalories(preview.caloriesPerServing)} kcal
                  <span className="text-protein">
                    {"  "}
                    {formatMacro(preview.proteinPerServing)}g P
                  </span>
                  <span className="text-fat">
                    {"  "}
                    {formatMacro(preview.fatPerServing)}g F
                  </span>
                </p>
              </div>
            ) : null}

            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Saved as <strong>USDA verified</strong>. If you have the package
              in hand, the label beats this — edit the food afterwards and add
              a photo.
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="btn-secondary pressable h-11 flex-1 text-[14px] font-[600]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy || !preview}
                className="btn-primary pressable flex h-11 flex-1 items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save food
              </button>
            </div>
          </Card>
        ) : null}

        {/* -------------------------------------------------- results */}
        {!detail && hits ? (
          hits.length === 0 ? (
            <p className="px-6 pt-8 text-center text-[13px] leading-relaxed text-muted">
              No matches. Try fewer words, or add the food by hand from its
              label.
            </p>
          ) : (
            <div className="space-y-2">
              {hits.map((hit) => (
                <button
                  key={hit.fdcId}
                  type="button"
                  onClick={() => void handleOpen(hit)}
                  disabled={busy}
                  className="pressable w-full rounded-[12px] border border-white/[0.06] bg-surface/60 px-4 py-3 text-left disabled:opacity-50"
                >
                  <p className="text-[14px] font-[600] leading-snug text-foreground">
                    {hit.description}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {hit.brand ? `${hit.brand} · ` : ""}
                    {hit.dataType}
                    {hit.servingText ? ` · ${hit.servingText}` : ""}
                  </p>
                </button>
              ))}
            </div>
          )
        ) : null}

        {!hits && !detail ? (
          <div className="flex flex-col items-center px-8 pt-12 text-center">
            <Database className="mb-3 h-5 w-5 text-muted" />
            <p className="text-[14px] font-[600] text-foreground">
              USDA FoodData Central
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Branded products and generic foods. Pick a serving, check the
              numbers, then save it to your database.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
