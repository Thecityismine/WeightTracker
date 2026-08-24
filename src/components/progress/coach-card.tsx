"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card, SectionLabel } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import type { WeekSummary } from "@/lib/progress";
import type { MacroTargets } from "@/types";

/**
 * Claude's read on the recent weeks.
 *
 * Deliberately on demand rather than automatic: it costs a call, and the
 * numbers above already say most of it. This is for "why has nothing moved".
 */
export function CoachCard({
  weeks,
  targets,
  startingWeight,
  goalWeight,
  unit,
}: {
  weeks: WeekSummary[];
  targets: MacroTargets;
  startingWeight: number;
  goalWeight: number;
  unit: string;
}) {
  const { getToken } = useAuth();
  const [reply, setReply] = useState<{ summary: string; suggestion: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enoughData = weeks.some((w) => w.loggedDays > 0);

  async function handleAsk() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          goal: `gain from ${startingWeight} ${unit} to ${goalWeight} ${unit}`,
          targets,
          // Only the fields the model needs — no raw documents.
          weeks: weeks.map((w) => ({
            weekStart: w.weekStart,
            loggedDays: w.loggedDays,
            avgCalories: w.avgCalories,
            avgProtein: w.avgProtein,
            calorieTargetDays: w.calorieTargetDays,
            avgWeight: w.avgWeight,
            weightChange: w.weightChange,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not build a summary.");
      setReply(json.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build a summary.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="px-5 py-4">
      <SectionLabel>Coach</SectionLabel>

      {reply ? (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            {reply.summary}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--blue)" }}>
            {reply.suggestion}
          </p>
          <button
            type="button"
            onClick={() => void handleAsk()}
            disabled={busy}
            className="mt-3 text-[12px] text-muted disabled:opacity-50"
          >
            Ask again
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {enoughData
              ? "Have Claude read the last few weeks and say what the numbers mean."
              : "Log a few days first — there is nothing to interpret yet."}
          </p>
          <button
            type="button"
            onClick={() => void handleAsk()}
            disabled={busy || !enoughData}
            className="btn-secondary pressable mt-3 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy ? "Reading your log…" : "Ask Claude"}
          </button>
        </>
      )}

      {error ? <p className="mt-2 text-[13px] text-danger">{error}</p> : null}
    </Card>
  );
}
