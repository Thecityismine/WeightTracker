"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Camera, Loader2, Minus, Trash2 } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { NumberField } from "@/components/ui/number-field";
import { useAuth } from "@/lib/auth-context";
import { useBodyComposition } from "@/lib/hooks/use-body-composition";
import { deleteComposition, saveComposition } from "@/lib/repo/body-composition";
import { downscaleImage } from "@/lib/image";
import {
  compareReadings,
  formatMetric,
  formatPercentChange,
  METRICS,
  type MetricChange,
  type MetricKey,
} from "@/lib/body-composition";
import { formatLongDate, fromDateKey, todayKey } from "@/lib/dates";
import { format } from "date-fns";
import type { BodyComposition } from "@/types";

type Draft = Partial<Record<MetricKey, number | null>> & {
  ratings?: Record<string, string> | null;
};

export function BodyCompositionCard() {
  const { user, getToken } = useAuth();
  const { readings, latest, previous } = useBodyComposition(user?.uid ?? null);

  const [busy, setBusy] = useState<"scan" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [date, setDate] = useState(todayKey());

  const changes = compareReadings(latest, previous);

  async function handleScreenshot(file: File) {
    setBusy("scan");
    setError(null);
    try {
      const { base64, mediaType } = await downscaleImage(file, 1800);
      const token = await getToken();
      const res = await fetch("/api/ai/scale-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not read that screenshot.");

      const r = json.reading;
      const next: Draft = { ratings: cleanRatings(r.ratings) };
      for (const m of METRICS) next[m.key] = r[m.key] ?? null;

      setDraft(next);
      setUnreadable(r.unreadable ?? []);
      setDate(todayKey());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that screenshot.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!user || !draft) return;
    setBusy("save");
    setError(null);
    try {
      await saveComposition(user.uid, {
        date,
        bodyFatPercent: draft.bodyFatPercent ?? null,
        bmi: draft.bmi ?? null,
        muscleMassLb: draft.muscleMassLb ?? null,
        visceralFat: draft.visceralFat ?? null,
        bodyWaterPercent: draft.bodyWaterPercent ?? null,
        subcutaneousFatPercent: draft.subcutaneousFatPercent ?? null,
        skeletalMusclePercent: draft.skeletalMusclePercent ?? null,
        boneMassLb: draft.boneMassLb ?? null,
        fatFreeMassLb: draft.fatFreeMassLb ?? null,
        bmrKcal: draft.bmrKcal ?? null,
        proteinPercent: draft.proteinPercent ?? null,
        metabolicAge: draft.metabolicAge ?? null,
        ratings: draft.ratings ?? null,
        source: "ai_screenshot",
      });
      setDraft(null);
      setUnreadable([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that reading.");
    } finally {
      setBusy(null);
    }
  }

  /* ---------------------------------------------------- review a scan */
  if (draft) {
    return (
      <Card className="px-5 py-4">
        <SectionLabel>Check the reading</SectionLabel>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          Correct anything misread before saving. A blank field is stored as
          not recorded, not as zero.
        </p>

        {unreadable.length > 0 ? (
          <p
            className="mt-2 rounded-[10px] px-3 py-2 text-[12px]"
            style={{ background: "rgba(255,181,71,0.08)", color: "var(--warning)" }}
          >
            Could not read: {unreadable.join(", ")}. Enter those by hand.
          </p>
        ) : null}

        <div className="mt-3">
          <label className="label-metric mb-1.5 block" htmlFor="bc-date">
            Reading date
          </label>
          <input
            id="bc-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input h-11 w-full px-3 text-[14px]"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {METRICS.map((m) => (
            <div key={m.key}>
              <label className="label-metric mb-1 block text-[10px]">
                {m.label} {m.unit ? `(${m.unit})` : ""}
              </label>
              <NumberField
                value={draft[m.key] ?? null}
                onChange={(v) => setDraft((d) => ({ ...d!, [m.key]: v }))}
                allowNull
                onNull={() => setDraft((d) => ({ ...d!, [m.key]: null }))}
                step="0.1"
                ariaLabel={m.label}
                placeholder="—"
                className="input h-10 w-full px-2.5 text-[14px]"
              />
            </div>
          ))}
        </div>

        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setUnreadable([]);
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
            Save reading
          </button>
        </div>
      </Card>
    );
  }

  /* ------------------------------------------------------- the grid */
  return (
    <Card className="px-4 py-4">
      <div className="flex items-baseline justify-between px-1">
        <SectionLabel>Body composition</SectionLabel>
        {latest ? (
          <span className="text-[11px] text-muted">
            {format(fromDateKey(latest.date), "MMM d")}
          </span>
        ) : null}
      </div>

      {latest ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {changes.map((c) => (
              <MetricTile key={c.def.key} change={c} />
            ))}
          </div>

          <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted">
            {previous
              ? `Change against your ${format(fromDateKey(previous.date), "MMMM d")} reading. Green means moving toward a lean gain.`
              : "Save a second reading to see change over time."}
          </p>
        </>
      ) : (
        <p className="mt-2 px-1 text-[13px] leading-relaxed text-muted">
          Import a screenshot from your scale app and the readings are filled in
          for you to check.
        </p>
      )}

      <label className="btn-secondary pressable mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 text-[14px] font-[600]">
        {busy === "scan" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {busy === "scan" ? "Reading screenshot…" : "Import scale screenshot"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleScreenshot(f);
            e.target.value = "";
          }}
        />
      </label>

      {latest ? (
        <button
          type="button"
          onClick={() => void deleteComposition(latest.date)}
          className="mt-2 flex w-full items-center justify-center gap-1.5 py-1.5 text-[12px] text-muted"
        >
          <Trash2 className="h-3 w-3" />
          Remove {formatLongDate(latest.date)} reading
        </button>
      ) : null}

      {readings.length > 0 ? (
        <p className="mt-1 text-center text-[11px] text-muted">
          {readings.length} reading{readings.length === 1 ? "" : "s"} stored
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-center text-[13px] text-danger">{error}</p>
      ) : null}
    </Card>
  );
}

function MetricTile({ change: c }: { change: MetricChange }) {
  const tint =
    c.favorable === true
      ? "var(--success)"
      : c.favorable === false
        ? "var(--danger)"
        : "var(--text-muted)";

  const Arrow =
    c.delta == null || c.delta === 0
      ? Minus
      : c.delta > 0
        ? ArrowUp
        : ArrowDown;

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-surface/50 px-2.5 py-2.5">
      <p className="text-[10px] leading-tight text-muted">{c.def.label}</p>

      <p className="metric mt-1 text-[17px] font-[650] leading-none text-foreground">
        {formatMetric(c.current, c.def)}
        {c.def.unit ? (
          <span className="text-[10px] font-[450] text-muted"> {c.def.unit}</span>
        ) : null}
      </p>

      <p
        className="metric mt-1.5 flex items-center gap-0.5 text-[11px]"
        style={{ color: tint }}
      >
        <Arrow className="h-3 w-3" strokeWidth={2.5} />
        {formatPercentChange(c.percentChange)}
      </p>

      {c.rating ? (
        <p className="mt-1 truncate text-[9.5px] text-muted">{c.rating}</p>
      ) : null}
    </div>
  );
}

/** Drop nulls so an all-empty ratings object is stored as null. */
function cleanRatings(
  raw: Record<string, string | null> | null | undefined,
): Record<string, string> | null {
  if (!raw) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

export type { BodyComposition };
