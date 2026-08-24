"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { StepperRow } from "@/components/ui/stepper-row";
import { useAuth } from "@/lib/auth-context";
import { useFoods } from "@/lib/hooks/use-foods";
import { useProfile } from "@/lib/hooks/use-profile";
import { useWeights } from "@/lib/hooks/use-weights";
import { loadStarterFoods } from "@/lib/seed-client";
import { defaultProfileInput, saveProfile } from "@/lib/repo/profile";
import { formatWeight } from "@/lib/nutrition";
import { daysSince } from "@/lib/dates";
import type { ProfileInput } from "@/lib/schemas";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.uid ?? null);
  const { foods } = useFoods(user?.uid ?? null);
  const { latest, average7 } = useWeights(user?.uid ?? null);

  // The form is derived, not copied into state: the stored profile is the
  // base and local edits layer on top. That way the form picks up the loaded
  // profile the moment it arrives without an effect racing to seed it, and
  // half-finished edits survive a background snapshot update.
  const [edits, setEdits] = useState<Partial<ProfileInput>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo<ProfileInput>(
    () =>
      profile
        ? {
            name: profile.name,
            startingWeight: profile.startingWeight,
            goalWeight: profile.goalWeight,
            startingDate: profile.startingDate,
            targetDate: profile.targetDate,
            heightInches: profile.heightInches,
            birthDate: profile.birthDate,
            sex: profile.sex,
            activityLevel: profile.activityLevel,
            workoutDaysPerWeek: profile.workoutDaysPerWeek,
            weightUnit: profile.weightUnit,
            dailyCalorieTarget: profile.dailyCalorieTarget,
            dailyProteinTarget: profile.dailyProteinTarget,
            dailyFatTarget: profile.dailyFatTarget,
          }
        : defaultProfileInput(),
    [profile],
  );

  const draft: ProfileInput = { ...base, ...edits };

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

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveProfile(user.uid, draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof ProfileInput>(k: K, v: ProfileInput[K]) =>
    setEdits((e) => ({ ...e, [k]: v }));

  if (profileLoading) {
    return (
      <main className="mx-auto max-w-lg">
        <PageHeader title="Settings" />
        <p className="px-5 text-[13px] text-muted">Loading…</p>
      </main>
    );
  }

  const unit = draft.weightUnit;
  const toGo = draft.goalWeight - (average7 ?? latest?.weight ?? draft.startingWeight);

  return (
    <main className="mx-auto max-w-lg">
      <PageHeader title="Settings" />

      <div className="space-y-6 px-4">
        {/* ---------------------------------------------------- profile */}
        <Card className="px-5 py-4">
          <SectionLabel>Profile</SectionLabel>

          <div className="mt-3">
            <label className="label-metric mb-2 block" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              className="input h-11 w-full px-3.5 text-[15px]"
            />
          </div>

          <div className="mt-3 divide-y divide-white/[0.06]">
            <StepperRow
              label="Starting weight"
              value={draft.startingWeight}
              onChange={(v) => set("startingWeight", v)}
              step={0.1}
              decimals={1}
              min={30}
              max={700}
              suffix={unit}
            />
            <StepperRow
              label="Goal weight"
              value={draft.goalWeight}
              onChange={(v) => set("goalWeight", v)}
              step={0.1}
              decimals={1}
              min={30}
              max={700}
              suffix={unit}
            />
            <StepperRow
              label="Height"
              value={draft.heightInches ?? 68}
              onChange={(v) => set("heightInches", v)}
              step={1}
              min={20}
              max={100}
              suffix="in"
            />
            <StepperRow
              label="Workouts per week"
              value={draft.workoutDaysPerWeek}
              onChange={(v) => set("workoutDaysPerWeek", v)}
              step={1}
              min={0}
              max={7}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label-metric mb-2 block" htmlFor="start">
                Start date
              </label>
              <input
                id="start"
                type="date"
                value={draft.startingDate}
                onChange={(e) => set("startingDate", e.target.value)}
                className="input h-11 w-full px-3 text-[14px]"
              />
            </div>
            <div>
              <label className="label-metric mb-2 block" htmlFor="birth">
                Birthday
              </label>
              <input
                id="birth"
                type="date"
                value={draft.birthDate ?? ""}
                onChange={(e) => set("birthDate", e.target.value || null)}
                className="input h-11 w-full px-3 text-[14px]"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label-metric mb-2 block" htmlFor="activity">
                Activity level
              </label>
              <select
                id="activity"
                value={draft.activityLevel}
                onChange={(e) =>
                  set("activityLevel", e.target.value as ProfileInput["activityLevel"])
                }
                className="input h-11 w-full px-3 text-[14px]"
              >
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="active">Active</option>
                <option value="very_active">Very active</option>
              </select>
            </div>
            <div>
              <label className="label-metric mb-2 block" htmlFor="unit">
                Weight unit
              </label>
              <select
                id="unit"
                value={draft.weightUnit}
                onChange={(e) =>
                  set("weightUnit", e.target.value as ProfileInput["weightUnit"])
                }
                className="input h-11 w-full px-3 text-[14px]"
              >
                <option value="lb">Pounds</option>
                <option value="kg">Kilograms</option>
              </select>
            </div>
          </div>

          {profile ? (
            <p className="metric mt-4 text-[12px] text-muted">
              Day {daysSince(profile.startingDate)} ·{" "}
              {average7 != null
                ? `${formatWeight(average7)} ${unit} 7-day average · ${formatWeight(Math.abs(toGo))} ${unit} to go`
                : "no weigh-ins yet"}
            </p>
          ) : null}
        </Card>

        {/* ---------------------------------------------------- targets */}
        <Card className="px-5 py-4">
          <SectionLabel>Daily targets</SectionLabel>
          <div className="mt-3 divide-y divide-white/[0.06]">
            <StepperRow
              label="Calories"
              value={draft.dailyCalorieTarget}
              onChange={(v) => set("dailyCalorieTarget", Math.round(v))}
              step={50}
              min={800}
              max={10000}
            />
            <StepperRow
              label="Protein"
              value={draft.dailyProteinTarget}
              onChange={(v) => set("dailyProteinTarget", v)}
              step={5}
              min={0}
              max={500}
              suffix="g"
            />
            <StepperRow
              label="Fat"
              value={draft.dailyFatTarget}
              onChange={(v) => set("dailyFatTarget", v)}
              step={5}
              min={0}
              max={400}
              suffix="g"
            />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Changing a target updates the Today screen immediately. Past days
            keep the numbers they were logged against.
          </p>
        </Card>

        <div>
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={saving}
            className="btn-primary pressable flex h-12 w-full items-center justify-center gap-2 text-[15px] font-[600] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saved ? "Saved" : "Save profile and targets"}
          </button>
          {error ? (
            <p className="mt-2 text-center text-[13px] text-danger">{error}</p>
          ) : null}
        </div>

        {/* ------------------------------------------ nutrition database */}
        <Card className="px-5 py-4">
          <SectionLabel>Nutrition database</SectionLabel>
          <div className="mt-1 divide-y divide-white/[0.06]">
            <LinkRow href="/foods" label="Manage foods" value={`${foods.length}`} />
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

        {/* ---------------------------------------------------- account */}
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
