"use client";

import { useState } from "react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { deleteWeight, saveWeight } from "@/lib/repo/weight-logs";
import { formatLongDate, isToday, type DateKey } from "@/lib/dates";
import type { WeightLog } from "@/types";

/** Scales read in tenths; 0.2 keeps the stepper from being a chore. */
const STEP = 0.2;

export function WeightSheet({
  open,
  date,
  existing,
  suggested,
  unit = "lb",
  onClose,
}: {
  open: boolean;
  date: DateKey;
  existing: WeightLog | null;
  /** Starting point when nothing is logged yet — last weight, or start weight. */
  suggested: number;
  unit?: string;
  onClose: () => void;
}) {
  const { user } = useAuth();

  const [weight, setWeight] = useState<number>(existing?.weight ?? suggested);
  const [note, setNote] = useState(existing?.note ?? "");
  const [waist, setWaist] = useState<string>(
    existing?.waistMeasurement != null ? String(existing.waistMeasurement) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await saveWeight(user.uid, {
        date,
        weight: round1(weight),
        waistMeasurement: waist.trim() ? Number(waist) : null,
        note: note.trim() ? note.trim() : null,
      });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save that weight.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteWeight(date);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label="Log weight">
      <div className="overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-2">
        <h2 className="text-[20px] font-[650] tracking-tight text-foreground">
          {existing ? "Edit weight" : "Log weight"}
        </h2>
        <p className="mt-0.5 text-[13px] text-secondary">
          {isToday(date) ? "Today, " : ""}
          {formatLongDate(date)}
        </p>

        <div className="mt-6 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Decrease weight"
            onClick={() => setWeight((w) => round1(w - STEP))}
            className="btn-secondary pressable flex h-14 w-14 items-center justify-center rounded-full"
          >
            <Minus className="h-5 w-5" strokeWidth={2.5} />
          </button>

          <label className="flex items-baseline gap-1.5">
            <span className="sr-only">Weight in {unit}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={Number.isFinite(weight) ? weight : ""}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="metric w-[128px] bg-transparent text-center text-[40px] font-[650] leading-none text-foreground outline-none"
            />
            <span className="text-[15px] text-muted">{unit}</span>
          </label>

          <button
            type="button"
            aria-label="Increase weight"
            onClick={() => setWeight((w) => round1(w + STEP))}
            className="btn-secondary pressable flex h-14 w-14 items-center justify-center rounded-full"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-muted">
          Weigh in first thing in the morning, before eating and after using the
          bathroom. Same conditions daily matters more than any single number.
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <label className="label-metric mb-2 block" htmlFor="waist">
              Waist (optional)
            </label>
            <input
              id="waist"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              placeholder="inches"
              className="input h-12 w-full px-3.5 text-[15px]"
            />
          </div>

          <div>
            <label className="label-metric mb-2 block" htmlFor="note">
              Note (optional)
            </label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Slept badly, big dinner…"
              className="input h-12 w-full px-3.5 text-[15px]"
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-[13px] text-danger">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || !Number.isFinite(weight) || weight <= 0}
          className="btn-primary pressable mt-6 flex h-12 w-full items-center justify-center gap-2 text-[15px] font-[600] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {existing ? "Save weight" : "Log weight"}
        </button>

        {existing ? (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="btn-destructive pressable mt-2.5 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Delete this entry
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
