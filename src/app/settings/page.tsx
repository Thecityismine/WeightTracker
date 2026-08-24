"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { GOAL } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import { useFoods } from "@/lib/hooks/use-foods";
import { useProfile } from "@/lib/hooks/use-profile";
import { loadStarterFoods } from "@/lib/seed-client";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { targets } = useProfile(user?.uid ?? null);
  const { foods } = useFoods(user?.uid ?? null);

  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  async function handleSeed() {
    if (!user) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const { created, skipped } = await loadStarterFoods(user.uid);
      setSeedResult(
        created === 0
          ? "All starter foods are already in your database."
          : `Added ${created} foods${skipped ? `, skipped ${skipped} already there` : ""}.`,
      );
    } catch (e) {
      setSeedResult(
        e instanceof Error ? e.message : "Could not load the starter foods.",
      );
    } finally {
      setSeeding(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg">
      <PageHeader title="Settings" />

      <div className="space-y-6 px-4">
        <Card className="px-5 py-4">
          <SectionLabel>Daily targets</SectionLabel>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <Row label="Calories" value={targets.calories.toLocaleString()} />
            <Row label="Protein" value={`${targets.protein} g`} />
            <Row label="Fat" value={`${targets.fat} g`} />
            <Row
              label="Expected gain"
              value={`${GOAL.weeklyGainLow}–${GOAL.weeklyGainHigh} lb/wk`}
            />
          </div>
          <p className="mt-3 text-[12px] text-muted">Editable in Phase 4.</p>
        </Card>

        <Card className="px-5 py-4">
          <SectionLabel>Nutrition database</SectionLabel>
          <div className="mt-1 divide-y divide-white/[0.06]">
            <LinkRow
              href="/foods"
              label="Manage foods"
              value={`${foods.length}`}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSeed()}
            disabled={seeding}
            className="btn-secondary pressable mt-4 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
          >
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load starter foods"
            )}
          </button>

          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            {seedResult ??
              "Adds 41 common foods entered from labels and USDA references. Safe to run more than once — it only adds what is missing."}
          </p>
        </Card>

        <Card className="px-5 py-4">
          <SectionLabel>Account</SectionLabel>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <Row label="Signed in as" value={user?.email ?? "—"} />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn-destructive pressable mt-4 h-11 w-full text-[14px] font-[600]"
          >
            Sign out
          </button>
        </Card>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[14px] text-secondary">{label}</span>
      <span className="metric text-[14px] text-foreground">{value}</span>
    </div>
  );
}

function LinkRow({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value?: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between py-3.5">
      <span className="text-[14px] text-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {value ? (
          <span className="metric text-[13px] text-muted">{value}</span>
        ) : null}
        <ChevronRight className="h-4 w-4 text-muted" />
      </span>
    </Link>
  );
}
