"use client";

import { format } from "date-fns";
import { SectionLabel } from "@/components/ui/card";
import { useDailyTotals } from "@/lib/hooks/use-daily-totals";
import {
  fromDateKey,
  shiftDateKey,
  todayKey,
  weekKeys,
  type DateKey,
} from "@/lib/dates";
import { formatCalories } from "@/lib/nutrition";

export function WeeklyCalories({
  userId,
  date,
  dailyTarget,
}: {
  userId: string | null;
  date: DateKey;
  dailyTarget: number;
}) {
  const currentWeek = weekKeys(date);
  const previousWeek = weekKeys(shiftDateKey(currentWeek[0], -7));
  const { totals, loading } = useDailyTotals(
    userId,
    previousWeek[0],
    currentWeek[6],
  );

  const today = todayKey();
  const throughIndex = currentWeek.includes(today)
    ? currentWeek.indexOf(today)
    : date < today
      ? 6
      : 0;
  const currentThrough = currentWeek.slice(0, throughIndex + 1);
  const previousThrough = previousWeek.slice(0, throughIndex + 1);
  const currentTotal = sumCalories(currentThrough, totals);
  const previousTotal = sumCalories(previousWeek, totals);
  const previousAtSamePoint = sumCalories(previousThrough, totals);
  const samePointChange = currentTotal - previousAtSamePoint;
  const currentTarget = dailyTarget * currentThrough.length;
  const previousTarget = dailyTarget * 7;
  const isCurrentWeek = currentWeek.includes(today);

  return (
    <section className="mt-8 border-t border-white/[0.06] px-4 pt-7 lg:px-0">
      <div className="mb-3">
        <SectionLabel>Weekly calories</SectionLabel>
        <p className="mt-1 text-[13px] text-secondary">
          {format(fromDateKey(currentWeek[0]), "MMM d")}–{format(fromDateKey(currentWeek[6]), "MMM d")}
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        {loading ? (
          <div className="grid h-32 place-items-center text-[13px] text-muted">
            Loading weekly totals…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5">
              <WeeklyMetric
                label={isCurrentWeek ? "This week so far" : "Selected week"}
                value={currentTotal}
                target={currentTarget}
                accent="blue"
              />
              <WeeklyMetric
                label="Previous week"
                value={previousTotal}
                target={previousTarget}
                accent="muted"
              />
            </div>

            <div className="mt-5 border-t border-white/[0.06] pt-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted">
                Same point last week
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="metric text-[14px] font-[600] text-secondary">
                  {formatCalories(previousAtSamePoint)} kcal
                </span>
                <span
                  className={`metric text-[12px] ${
                    samePointChange >= 0 ? "text-success" : "text-warning"
                  }`}
                >
                  {signedCalories(samePointChange)} kcal
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function WeeklyMetric({
  label,
  value,
  target,
  accent,
}: {
  label: string;
  value: number;
  target: number;
  accent: "blue" | "muted";
}) {
  const ratio = target > 0 ? value / target : 0;
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="metric mt-1 truncate text-[24px] font-[650] tracking-tight text-foreground sm:text-[28px]">
        {formatCalories(value)}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">kcal</p>
      <div className="progress-track mt-3 h-1.5">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(ratio, 1) * 100}%`,
            background:
              accent === "blue"
                ? "linear-gradient(90deg, var(--blue-dark), var(--cyan))"
                : "rgba(154,166,178,0.55)",
          }}
        />
      </div>
      <p className="metric mt-1.5 text-[10px] text-muted">
        {Math.round(ratio * 100)}% of {formatCalories(target)}
      </p>
    </div>
  );
}

function sumCalories(
  dates: DateKey[],
  totals: ReturnType<typeof useDailyTotals>["totals"],
): number {
  return dates.reduce((sum, key) => sum + (totals[key]?.calories ?? 0), 0);
}

function signedCalories(value: number): string {
  const rounded = formatCalories(Math.abs(value));
  if (value > 0) return `+${rounded}`;
  if (value < 0) return `−${rounded}`;
  return rounded;
}
