"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { DEFAULT_TARGETS, GOAL } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <main className="mx-auto max-w-lg">
      <PageHeader title="Settings" />

      <div className="space-y-6 px-4">
        <Card className="px-5 py-4">
          <SectionLabel>Daily targets</SectionLabel>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <Row label="Calories" value={DEFAULT_TARGETS.calories.toLocaleString()} />
            <Row label="Protein" value={`${DEFAULT_TARGETS.protein} g`} />
            <Row label="Fat" value={`${DEFAULT_TARGETS.fat} g`} />
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
            <LinkRow href="/foods" label="Manage foods" />
          </div>
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

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between py-3.5">
      <span className="text-[14px] text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted" />
    </Link>
  );
}
