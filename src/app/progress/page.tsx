"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2, TrendingUp } from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import {
  DailyChart,
  IntakeVsChangeChart,
  WeightChart,
  type DailyPoint,
  type WeeklyPoint,
  type WeightPoint,
} from "@/components/progress/charts";
import { BodyCompositionCard } from "@/components/progress/body-composition-card";
import { CoachCard } from "@/components/progress/coach-card";
import { useAuth } from "@/lib/auth-context";
import { useDailyTotals } from "@/lib/hooks/use-daily-totals";
import { useProfile } from "@/lib/hooks/use-profile";
import { useWeights } from "@/lib/hooks/use-weights";
import { useMounted } from "@/lib/use-mounted";
import { saveProfile } from "@/lib/repo/profile";
import { formatCalories, formatMacro, formatWeight, trailingAverage } from "@/lib/nutrition";
import {
  averageWeeklyGain,
  buildWeeks,
  computeProgress,
  detectStall,
  estimateGoalDate,
  interpretWeek,
} from "@/lib/progress";
import { fromDateKey, shiftDateKey, todayKey } from "@/lib/dates";
import { GOAL } from "@/lib/constants";

const WINDOW_DAYS = 84; // twelve weeks

export default function ProgressPage() {
  const { user } = useAuth();
  const mounted = useMounted();
  const { profile, targets } = useProfile(user?.uid ?? null);
  const { weights, average7 } = useWeights(user?.uid ?? null);

  const range = useMemo(() => {
    const to = todayKey();
    return { from: shiftDateKey(to, -WINDOW_DAYS), to };
  }, []);

  const { totals } = useDailyTotals(user?.uid ?? null, range.from, range.to);

  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const totalsList = useMemo(() => Object.values(totals), [totals]);

  const weeks = useMemo(
    () => buildWeeks(totalsList, weights, targets),
    [totalsList, weights, targets],
  );

  const startingWeight = profile?.startingWeight ?? GOAL.startingWeight;
  const goalWeight = profile?.goalWeight ?? GOAL.goalWeight;
  const unit = profile?.weightUnit ?? "lb";

  const progress = computeProgress(startingWeight, goalWeight, average7);
  const weeklyGain = averageWeeklyGain(weeks);
  const goalDate = estimateGoalDate(progress.remaining, weeklyGain, todayKey());
  const recommendation = detectStall(weeks, targets.calories);
  const lastWeek = weeks.length ? weeks[weeks.length - 1] : null;

  // Weight series with a trailing average at each point.
  const weightData: WeightPoint[] = useMemo(
    () =>
      weights.map((w, i) => ({
        date: w.date,
        label: format(fromDateKey(w.date), "MMM d"),
        weight: w.weight,
        average: trailingAverage(
          weights.slice(0, i + 1).map((x) => x.weight),
          7,
        ),
      })),
    [weights],
  );

  const dailySeries = useMemo(() => {
    const logged = totalsList
      .filter((t) => t.entryCount > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const cal: DailyPoint[] = logged.map((t) => ({
      label: format(fromDateKey(t.date), "M/d"),
      value: Math.round(t.calories),
    }));
    const pro: DailyPoint[] = logged.map((t) => ({
      label: format(fromDateKey(t.date), "M/d"),
      value: Math.round(t.protein),
    }));
    return { cal, pro };
  }, [totalsList]);

  const weeklyData: WeeklyPoint[] = useMemo(
    () =>
      weeks.map((w) => ({
        label: format(fromDateKey(w.weekStart), "MMM d"),
        calories: w.avgCalories != null ? Math.round(w.avgCalories) : null,
        change: w.weightChange,
      })),
    [weeks],
  );

  async function applySuggestion() {
    if (!user || !profile) return;
    setApplying(true);
    try {
      await saveProfile(user.uid, {
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
        dailyCalorieTarget:
          profile.dailyCalorieTarget + recommendation.suggestedCalorieIncrease,
        dailyProteinTarget: profile.dailyProteinTarget,
        dailyFatTarget: profile.dailyFatTarget,
      });
      setApplied(true);
    } finally {
      setApplying(false);
    }
  }

  if (!mounted) {
    return (
      <main className="mx-auto max-w-lg lg:max-w-5xl lg:px-6">
        <PageHeader title="Progress" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg lg:max-w-5xl lg:px-6">
      <PageHeader
        title="Progress"
        subtitle={`${formatWeight(startingWeight)} to ${formatWeight(goalWeight)} ${unit}`}
      />

      {/* Charts pair up once there is width for two to be read side by side. */}
      <div className="space-y-5 px-4 pb-10 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 lg:px-0">
        {/* ------------------------------------------- weight progress */}
        <Card className="px-5 py-5">
          <SectionLabel>Weight progress</SectionLabel>

          {/* The seven-day average is the headline. A single morning reading
              is mostly hydration and cannot be read as progress. */}
          <p className="metric mt-2 text-[40px] font-[650] leading-none text-foreground">
            {average7 != null ? formatWeight(average7) : "—"}
            <span className="text-[15px] font-[450] text-muted"> {unit}</span>
          </p>
          <p className="mt-1 text-[13px] text-secondary">
            Current seven-day average
          </p>

          <div className="progress-track mt-5 h-2 w-full">
            <div
              className={`progress-fill ${
                progress.reached ? "progress-complete" : "progress-calories"
              }`}
              style={{ width: `${Math.max(progress.fraction * 100, 1.5)}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between">
            <span className="metric text-[12px] text-muted">
              {formatWeight(startingWeight)} start
            </span>
            <span className="metric text-[12px] text-muted">
              {formatWeight(goalWeight)} goal
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat
              label="Gained"
              value={`${progress.gained >= 0 ? "+" : ""}${formatWeight(progress.gained)}`}
              tint={progress.gained > 0 ? "var(--success)" : undefined}
            />
            <Stat label="To go" value={formatWeight(Math.max(0, progress.remaining))} />
            <Stat label="Complete" value={`${Math.round(progress.fraction * 100)}%`} />
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            {weeklyGain != null
              ? `Averaging ${weeklyGain >= 0 ? "+" : ""}${weeklyGain.toFixed(2)} ${unit} per week. `
              : "Not enough weigh-ins yet to measure a rate. "}
            {goalDate
              ? `At this rate you reach ${formatWeight(goalWeight)} ${unit} around ${format(
                  fromDateKey(goalDate),
                  "MMMM d, yyyy",
                )}.`
              : ""}
          </p>
        </Card>

        {/* ------------------------------------------------ this week */}
        <Card className="px-5 py-4">
          <SectionLabel>This week</SectionLabel>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground">
            {interpretWeek(lastWeek, targets)}
          </p>

          {lastWeek ? (
            <div className="mt-4 divide-y divide-white/[0.06]">
              <SummaryRow
                label="Average calories"
                value={
                  lastWeek.avgCalories != null
                    ? `${formatCalories(lastWeek.avgCalories)}/day`
                    : "—"
                }
              />
              <SummaryRow
                label="Average protein"
                value={
                  lastWeek.avgProtein != null
                    ? `${formatMacro(lastWeek.avgProtein)} g/day`
                    : "—"
                }
              />
              <SummaryRow
                label="Average fat"
                value={
                  lastWeek.avgFat != null
                    ? `${formatMacro(lastWeek.avgFat)} g/day`
                    : "—"
                }
              />
              <SummaryRow
                label="Calorie-target days"
                value={`${lastWeek.calorieTargetDays} of ${lastWeek.loggedDays}`}
              />
              <SummaryRow
                label="Protein-target days"
                value={`${lastWeek.proteinTargetDays} of ${lastWeek.loggedDays}`}
              />
              <SummaryRow
                label="Average weight"
                value={
                  lastWeek.avgWeight != null
                    ? `${formatWeight(lastWeek.avgWeight)} ${unit}`
                    : "—"
                }
              />
              <SummaryRow
                label="Weekly change"
                value={
                  lastWeek.weightChange != null
                    ? `${lastWeek.weightChange >= 0 ? "+" : ""}${formatWeight(lastWeek.weightChange)} ${unit}`
                    : "—"
                }
              />
            </div>
          ) : null}
        </Card>

        {/* -------------------------------------------- recommendation */}
        <Card
          className="px-5 py-4"
          active={recommendation.stalled && !applied}
        >
          <SectionLabel>Recommendation</SectionLabel>
          <p className="mt-2 flex gap-2 text-[14px] leading-relaxed text-foreground">
            <TrendingUp
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{
                color:
                  recommendation.verdict === "stalled"
                    ? "var(--warning)"
                    : recommendation.verdict === "on_track"
                      ? "var(--success)"
                      : "var(--text-muted)",
              }}
            />
            {applied
              ? `Calorie target raised to ${(
                  targets.calories
                ).toLocaleString()}. Give it two weeks before judging the result.`
              : recommendation.message}
          </p>

          {/* The app recommends. Changing a target stays your decision. */}
          {recommendation.stalled && !applied ? (
            <button
              type="button"
              onClick={() => void applySuggestion()}
              disabled={applying || !profile}
              className="btn-primary pressable mt-4 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Raise target by {recommendation.suggestedCalorieIncrease} calories
            </button>
          ) : null}

          {recommendation.stalled && !profile ? (
            <p className="mt-2 text-[12px] text-muted">
              Save your profile in Settings first so the new target has
              somewhere to live.
            </p>
          ) : null}
        </Card>

        <BodyCompositionCard />

        <CoachCard
          weeks={weeks}
          targets={targets}
          startingWeight={startingWeight}
          goalWeight={goalWeight}
          unit={unit}
        />

        {/* ------------------------------------------------- the charts */}
        <ChartCard title="Weight" hint="Daily in gray, seven-day average in blue">
          {weightData.length >= 2 ? (
            <WeightChart data={weightData} />
          ) : (
            <Empty>Log weight on a few mornings to see the trend.</Empty>
          )}
        </ChartCard>

        <ChartCard title="Daily calories" hint={`Target ${formatCalories(targets.calories)}`}>
          {dailySeries.cal.length >= 2 ? (
            <DailyChart
              data={dailySeries.cal}
              target={targets.calories}
              color="rgba(0,168,255,0.55)"
            />
          ) : (
            <Empty>Log a couple of days to see intake.</Empty>
          )}
        </ChartCard>

        <ChartCard title="Daily protein" hint={`Target ${formatMacro(targets.protein)} g`}>
          {dailySeries.pro.length >= 2 ? (
            <DailyChart
              data={dailySeries.pro}
              target={targets.protein}
              color="rgba(167,139,250,0.6)"
            />
          ) : (
            <Empty>Log a couple of days to see protein.</Empty>
          )}
        </ChartCard>

        <ChartCard
          title="Intake vs weight change"
          hint="Weekly average calories against the weight it produced"
        >
          {weeklyData.length >= 2 ? (
            <IntakeVsChangeChart data={weeklyData} />
          ) : (
            <Empty>Two full weeks are needed before this means anything.</Empty>
          )}
        </ChartCard>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-surface/50 px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className="metric mt-0.5 text-[17px] font-[650]"
        style={{ color: tint ?? "var(--text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-secondary">{label}</span>
      <span className="metric text-[13px] text-foreground">{value}</span>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="px-3 py-4">
      <div className="mb-1 px-2">
        <SectionLabel>{title}</SectionLabel>
        <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-10 text-center text-[13px] leading-relaxed text-muted">
      {children}
    </p>
  );
}
