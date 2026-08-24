"use client";

import { useMemo, useState } from "react";
import { useMounted } from "@/lib/use-mounted";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import { CalendarCheck, ChevronLeft, ChevronRight, Copy, FileText, Loader2 } from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useDailyTotals } from "@/lib/hooks/use-daily-totals";
import { useDayLogs } from "@/lib/hooks/use-day-logs";
import { useProfile } from "@/lib/hooks/use-profile";
import { copyDay } from "@/lib/repo/food-logs";
import { dayStatus, formatCalories, formatMacro } from "@/lib/nutrition";
import { MEAL_CATEGORIES, MEAL_LABELS } from "@/lib/constants";
import {
  formatLongDate,
  isToday,
  toDateKey,
  todayKey,
  type DateKey,
} from "@/lib/dates";
import type { DailyTotals, DayStatus } from "@/types";

/** Status → the thin bottom line under each date. */
const STATUS_COLOR: Record<DayStatus, string | null> = {
  none: null,
  below: "var(--danger)",
  near: "var(--warning)",
  ontarget: "var(--success)",
  surplus: "var(--fat)",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { targets } = useProfile(user?.uid ?? null);

  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState<DateKey>(todayKey());

  // The grid depends on today's date, which the server cannot know — gate on
  // mount so the prerendered HTML never disagrees with the client.
  const mounted = useMounted();

  // One memo keyed on a primitive. Deriving gridStart/gridEnd outside and
  // depending on them would memoize nothing: they are fresh Date objects on
  // every render.
  const { month, gridStartKey, gridEndKey, weeks } = useMemo(() => {
    const m = addMonths(new Date(), monthOffset);
    const gs = startOfWeek(startOfMonth(m), { weekStartsOn: 0 });
    const ge = endOfWeek(endOfMonth(m), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: gs, end: ge });

    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

    return {
      month: m,
      gridStartKey: toDateKey(gs),
      gridEndKey: toDateKey(ge),
      weeks: rows,
    };
  }, [monthOffset]);

  const { totals } = useDailyTotals(
    user?.uid ?? null,
    gridStartKey,
    gridEndKey,
  );

  if (!mounted) {
    return (
      <main className="mx-auto max-w-lg">
        <PageHeader title="Calendar" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg">
      <PageHeader title="Calendar" />

      <div className="px-4">
        {/* ------------------------------------------------ month header */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonthOffset((m) => m - 1)}
            className="btn-secondary pressable flex h-10 w-10 items-center justify-center rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="text-center">
            <p className="text-[17px] font-[650] text-foreground">
              {format(month, "MMMM yyyy")}
            </p>
            {monthOffset !== 0 ? (
              <button
                type="button"
                onClick={() => {
                  setMonthOffset(0);
                  setSelected(todayKey());
                }}
                className="text-[12px] text-blue"
              >
                Jump to today
              </button>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonthOffset((m) => m + 1)}
            disabled={monthOffset >= 0}
            className="btn-secondary pressable flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="text-center text-[11px] font-[550] text-muted"
            >
              {d}
            </span>
          ))}
        </div>

        {/* -------------------------------------------------------- grid */}
        {weeks.map((week, wi) => (
          <div key={wi}>
            <div className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const key = toDateKey(day);
                const t = totals[key];
                return (
                  <DayCell
                    key={key}
                    date={day}
                    dateKey={key}
                    totals={t}
                    target={targets.calories}
                    inMonth={isSameMonth(day, month)}
                    selected={key === selected}
                    onSelect={() => setSelected(key)}
                  />
                );
              })}
            </div>
            <WeekSummary week={week} totals={totals} target={targets.calories} />
          </div>
        ))}

        <p className="mt-4 px-1 text-[12px] leading-relaxed text-muted">
          One low day is not a failure. The weekly average is what moves the
          scale.
        </p>

        <Link
          href="/calendar/report"
          className="btn-secondary pressable mt-4 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600]"
        >
          <FileText className="h-4 w-4" />
          Monthly report
        </Link>

        <SelectedDay date={selected} targetsCalories={targets.calories} />
      </div>
    </main>
  );
}

function DayCell({
  date,
  dateKey,
  totals,
  target,
  inMonth,
  selected,
  onSelect,
}: {
  date: Date;
  dateKey: DateKey;
  totals?: DailyTotals;
  target: number;
  inMonth: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  // Status is derived from the current target rather than read from the
  // stored record, so changing a target recolors history consistently.
  const status = totals
    ? dayStatus(totals.calories, target, totals.entryCount > 0)
    : "none";
  const line = STATUS_COLOR[status];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isToday(dateKey) ? "date" : undefined}
      className="relative flex h-[58px] flex-col items-center justify-start rounded-[10px] border px-0.5 pt-1.5 transition-colors"
      style={{
        borderColor: selected ? "var(--blue)" : "transparent",
        background: selected ? "rgba(0,168,255,0.12)" : "transparent",
        boxShadow: selected ? "0 0 18px rgba(0,168,255,0.12)" : undefined,
        opacity: inMonth ? 1 : 0.28,
      }}
    >
      <span
        className={`metric text-[12px] ${
          isToday(dateKey)
            ? "font-[700] text-blue"
            : "font-[550] text-foreground"
        }`}
      >
        {format(date, "d")}
      </span>

      {totals && totals.entryCount > 0 ? (
        <>
          <span className="metric mt-0.5 text-[9.5px] leading-tight text-secondary">
            {Math.round(totals.calories).toLocaleString()}
          </span>
          <span className="metric text-[9.5px] leading-tight text-muted">
            {Math.round(totals.protein)}P
          </span>
        </>
      ) : null}

      {line ? (
        <span
          className="absolute inset-x-2 bottom-1 h-[2px] rounded-full"
          style={{ background: line }}
        />
      ) : null}
    </button>
  );
}

function WeekSummary({
  week,
  totals,
  target,
}: {
  week: Date[];
  totals: Record<DateKey, DailyTotals>;
  target: number;
}) {
  const logged = week
    .map((d) => totals[toDateKey(d)])
    .filter((t): t is DailyTotals => Boolean(t) && t!.entryCount > 0);

  if (logged.length === 0) {
    return <div className="mb-1.5 h-4" />;
  }

  const avg =
    logged.reduce((sum, t) => sum + t.calories, 0) / logged.length;
  const onTarget = logged.filter((t) => t.calories >= target).length;

  return (
    <div className="mb-1.5 flex justify-end gap-2 pr-1 pt-0.5">
      <span className="metric text-[10.5px] text-muted">
        {formatCalories(avg)} avg
      </span>
      <span
        className="metric text-[10.5px]"
        style={{
          color: onTarget >= 5 ? "var(--success)" : "var(--text-muted)",
        }}
      >
        {onTarget}/{logged.length} on target
      </span>
    </div>
  );
}

/** The selected day's full log, with a copy-forward action. */
function SelectedDay({
  date,
  targetsCalories,
}: {
  date: DateKey;
  targetsCalories: number;
}) {
  const { user } = useAuth();
  const { targets } = useProfile(user?.uid ?? null);
  const { logs, loading } = useDayLogs(user?.uid ?? null, date);

  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const total = logs.reduce((s, l) => s + l.caloriesSnapshot, 0);
  const protein = logs.reduce((s, l) => s + l.proteinSnapshot, 0);

  async function handleCopy() {
    if (!user) return;
    setCopying(true);
    setCopied(null);
    try {
      const n = await copyDay(user.uid, date, todayKey(), targets);
      setCopied(
        n === 0 ? "Nothing to copy from that day." : `Copied ${n} foods to today.`,
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <Card className="mt-5 mb-8 px-5 py-4">
      <SectionLabel>
        {isToday(date) ? "Today" : formatLongDate(date)}
      </SectionLabel>

      {loading ? (
        <p className="mt-3 text-[13px] text-muted">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">No foods logged this day.</p>
      ) : (
        <>
          <p className="metric mt-1.5 text-[22px] font-[650] text-foreground">
            {formatCalories(total)}
            <span className="text-[13px] font-[450] text-muted">
              {" / "}
              {formatCalories(targetsCalories)} kcal
            </span>
            <span className="ml-3 text-[13px] font-[450] text-protein">
              {formatMacro(protein)}g protein
            </span>
          </p>

          <div className="mt-3 space-y-3">
            {MEAL_CATEGORIES.map((meal) => {
              const rows = logs.filter((l) => l.mealCategory === meal);
              if (rows.length === 0) return null;
              return (
                <div key={meal}>
                  <p className="label-metric">{MEAL_LABELS[meal]}</p>
                  {rows.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-baseline justify-between gap-3 border-b border-white/[0.03] py-1.5"
                    >
                      <span className="truncate text-[13px] text-foreground">
                        {l.nameSnapshot}
                        <span className="metric text-muted">
                          {"  "}
                          {formatQty(l.quantity)}×
                        </span>
                      </span>
                      <span className="metric shrink-0 text-[13px] text-secondary">
                        {formatCalories(l.caloriesSnapshot)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {!isToday(date) ? (
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={copying}
              className="btn-secondary pressable mt-4 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-[600] disabled:opacity-60"
            >
              {copying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy this day to today
            </button>
          ) : null}

          {copied ? (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-success">
              <CalendarCheck className="h-3.5 w-3.5" />
              {copied}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
