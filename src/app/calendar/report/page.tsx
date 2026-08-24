"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, Copy, Loader2, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/hooks/use-profile";
import { listLogsForRange } from "@/lib/repo/food-logs";
import { listWeights } from "@/lib/repo/weight-logs";
import {
  buildMonthlyReport,
  describeCoverage,
  monthBounds,
  type MonthlyReport,
  type PartialStat,
} from "@/lib/monthly-report";
import { formatCalories, formatMacro, formatWeight } from "@/lib/nutrition";
import { fromDateKey } from "@/lib/dates";
import { useMounted } from "@/lib/use-mounted";

export default function MonthlyReportPage() {
  const { user } = useAuth();
  const { profile, targets } = useProfile(user?.uid ?? null);
  const mounted = useMounted();

  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const month = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + offset, 1);
  }, [offset]);

  const bounds = monthBounds(month.getFullYear(), month.getMonth());
  const unit = profile?.weightUnit ?? "lb";

  async function handleGenerate() {
    if (!user) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const [logs, weights] = await Promise.all([
        listLogsForRange(user.uid, bounds.from, bounds.to),
        listWeights(user.uid, 400),
      ]);
      setReport(
        buildMonthlyReport(bounds.from, bounds.to, logs, weights, targets),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the report.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!report) return;
    await navigator.clipboard.writeText(
      reportAsText(report, profile?.name ?? "", unit, month),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  if (!mounted) return <main className="mx-auto max-w-3xl" />;

  return (
    <main className="mx-auto max-w-3xl">
      <div className="no-print px-4 pb-2 pt-8">
        <Link
          href="/calendar"
          className="mb-3 flex items-center gap-1 text-[13px] text-muted"
        >
          <ChevronLeft className="h-4 w-4" />
          Calendar
        </Link>

        <h1 className="px-1 text-[26px] font-[650] tracking-tight text-foreground">
          Monthly report
        </h1>
        <p className="mt-1 px-1 text-[13px] leading-relaxed text-muted">
          A printable summary of intake and weight to share with a clinician.
        </p>

        <div className="mt-4 flex gap-2">
          <select
            value={offset}
            onChange={(e) => {
              setOffset(Number(e.target.value));
              setReport(null);
            }}
            aria-label="Month"
            className="input h-11 flex-1 px-3 text-[14px]"
          >
            {[0, -1, -2, -3, -4, -5].map((o) => {
              const d = new Date();
              const m = new Date(d.getFullYear(), d.getMonth() + o, 1);
              return (
                <option key={o} value={o}>
                  {format(m, "MMMM yyyy")}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy}
            className="btn-primary pressable flex h-11 items-center justify-center gap-2 px-5 text-[14px] font-[600] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate
          </button>
        </div>

        {report ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary pressable flex h-11 flex-1 items-center justify-center gap-2 text-[14px] font-[600]"
            >
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="btn-secondary pressable flex h-11 flex-1 items-center justify-center gap-2 text-[14px] font-[600]"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied" : "Copy as text"}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-[13px] text-danger">{error}</p>
        ) : null}
      </div>

      {report ? (
        <div className="px-4 pb-12">
          <ReportDocument
            report={report}
            name={profile?.name ?? ""}
            unit={unit}
            month={month}
          />
        </div>
      ) : null}
    </main>
  );
}

function ReportDocument({
  report,
  name,
  unit,
  month,
}: {
  report: MonthlyReport;
  name: string;
  unit: string;
  month: Date;
}) {
  const r = report;

  return (
    <article className="paper mt-3 px-7 py-8 text-[13px] leading-relaxed">
      <header className="mb-5 border-b border-[#c9d0d7] pb-4">
        <h1 className="text-[21px] font-[650] leading-tight">
          Nutrition and weight report
        </h1>
        <p className="mt-0.5 text-[14px]">{format(month, "MMMM yyyy")}</p>
        <p className="muted-ink mt-2 text-[12px]">
          {name ? `${name} · ` : ""}
          Prepared {format(new Date(), "MMMM d, yyyy")} ·{" "}
          {r.daysLogged} of {r.daysInMonth} days logged · {r.entriesTotal} food
          entries
        </p>
      </header>

      {/* The single most important paragraph for a clinical reader. */}
      <section className="mb-5 rounded-[8px] border border-[#e0d3a8] bg-[#fdf8ea] px-4 py-3">
        <p className="text-[12px] font-[600]">How to read this</p>
        <p className="muted-ink mt-1 text-[12px]">
          These figures come from self-reported food logging, not measurement.
          Portions are estimated by the person eating. Calories, protein, fat,
          carbohydrate and fiber are recorded for every food. The four values in
          the second table are only present when a food&apos;s label listed them —
          each shows the share of calories it covers, and a figure below 100%
          coverage is a <strong>minimum</strong>, not an average.
        </p>
      </section>

      <Section title="Weight">
        <table>
          <tbody>
            <Row label="Weigh-ins recorded" value={String(r.weight.entries)} />
            <Row
              label="First recorded"
              value={r.weight.start != null ? `${formatWeight(r.weight.start)} ${unit}` : "—"}
            />
            <Row
              label="Last recorded"
              value={r.weight.end != null ? `${formatWeight(r.weight.end)} ${unit}` : "—"}
            />
            <Row
              label="Change over the month"
              value={
                r.weight.change != null
                  ? `${r.weight.change >= 0 ? "+" : ""}${formatWeight(r.weight.change)} ${unit}`
                  : "—"
              }
            />
            <Row
              label="Average"
              value={r.weight.average != null ? `${formatWeight(r.weight.average)} ${unit}` : "—"}
            />
            <Row
              label="Range"
              value={
                r.weight.min != null && r.weight.max != null
                  ? `${formatWeight(r.weight.min)} – ${formatWeight(r.weight.max)} ${unit}`
                  : "—"
              }
            />
          </tbody>
        </table>
      </Section>

      <Section title="Daily intake — complete data">
        <table>
          <thead>
            <tr>
              <th>Nutrient</th>
              <th>Daily average</th>
              <th>Range</th>
              <th>Month total</th>
            </tr>
          </thead>
          <tbody>
            <CoreRow label="Calories" stat={r.calories} unit="kcal" whole />
            <CoreRow label="Protein" stat={r.protein} unit="g" />
            <CoreRow label="Fat" stat={r.fat} unit="g" />
            <CoreRow label="Carbohydrate" stat={r.carbs} unit="g" />
            <CoreRow label="Fiber" stat={r.fiber} unit="g" />
          </tbody>
        </table>
        <p className="muted-ink mt-2 text-[11px]">
          Averages are per logged day ({r.daysLogged}
          {r.daysLogged === 1 ? " day" : " days"}), not per calendar day. Daily
          targets during this period: {formatCalories(r.targets.calories)} kcal,{" "}
          {formatMacro(r.targets.protein)} g protein, {formatMacro(r.targets.fat)} g
          fat. Calorie target met on {r.calorieTargetDays} of {r.daysLogged} logged
          days; protein target on {r.proteinTargetDays}.
        </p>
      </Section>

      <Section title="Daily intake — partial data">
        <table>
          <thead>
            <tr>
              <th>Nutrient</th>
              <th>Daily figure</th>
              <th>Month total</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            <PartialRow label="Sugar" stat={r.sugar} unit="g" />
            <PartialRow label="Saturated fat" stat={r.saturatedFat} unit="g" />
            <PartialRow label="Cholesterol" stat={r.cholesterolMg} unit="mg" />
            <PartialRow label="Sodium" stat={r.sodiumMg} unit="mg" />
          </tbody>
        </table>

        <div className="mt-2 space-y-1">
          <CoverageNote label="Sugar" stat={r.sugar} />
          <CoverageNote label="Saturated fat" stat={r.saturatedFat} />
          <CoverageNote label="Cholesterol" stat={r.cholesterolMg} />
          <CoverageNote label="Sodium" stat={r.sodiumMg} />
        </div>
      </Section>

      <section className="page-break mt-6">
        <h2 className="mb-2 text-[15px] font-[650]">Daily detail</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>kcal</th>
              <th>Protein</th>
              <th>Fat</th>
              <th>Carb</th>
              <th>Fiber</th>
              <th>Sugar</th>
              <th>Sat fat</th>
              <th>Chol</th>
              <th>Sodium</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {r.days.map((d) => (
              <tr key={d.date}>
                <td>{format(fromDateKey(d.date), "MMM d")}</td>
                <td>{d.calories ? Math.round(d.calories) : "—"}</td>
                <td>{d.calories ? formatMacro(d.protein) : "—"}</td>
                <td>{d.calories ? formatMacro(d.fat) : "—"}</td>
                <td>{d.calories ? formatMacro(d.carbs) : "—"}</td>
                <td>{d.calories ? formatMacro(d.fiber) : "—"}</td>
                <td>{d.sugar != null ? formatMacro(d.sugar) : "—"}</td>
                <td>{d.saturatedFat != null ? formatMacro(d.saturatedFat) : "—"}</td>
                <td>{d.cholesterolMg != null ? Math.round(d.cholesterolMg) : "—"}</td>
                <td>{d.sodiumMg != null ? Math.round(d.sodiumMg) : "—"}</td>
                <td>{d.weight != null ? formatWeight(d.weight) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted-ink mt-2 text-[11px]">
          A dash means no value was recorded, which is not the same as zero.
          Sugar, saturated fat, cholesterol and sodium show a dash on days when
          none of the foods eaten carried that value on their label.
        </p>
      </section>

      <footer className="muted-ink mt-6 border-t border-[#e4e8ec] pt-3 text-[11px]">
        Generated by a personal food tracker. Food entries are logged by hand
        from nutrition labels, USDA FoodData Central reference values, or
        estimates; they are not laboratory measurements and should be read as an
        approximate record of habitual intake.
      </footer>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[15px] font-[650]">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  );
}

function CoreRow({
  label,
  stat,
  unit,
  whole = false,
}: {
  label: string;
  stat: { dailyAverage: number; min: number; max: number; total: number };
  unit: string;
  whole?: boolean;
}) {
  const f = (n: number) => (whole ? Math.round(n).toLocaleString() : formatMacro(n));
  return (
    <tr>
      <td>{label}</td>
      <td>
        {f(stat.dailyAverage)} {unit}
      </td>
      <td>
        {f(stat.min)} – {f(stat.max)}
      </td>
      <td>{Math.round(stat.total).toLocaleString()} {unit}</td>
    </tr>
  );
}

function PartialRow({
  label,
  stat,
  unit,
}: {
  label: string;
  stat: PartialStat;
  unit: string;
}) {
  const none = stat.entriesWithData === 0;
  const pct = Math.round(stat.coverage * 100);

  return (
    <tr>
      <td>{label}</td>
      <td>
        {none ? "—" : `${stat.coverage >= 0.995 ? "" : "≥ "}${Math.round(stat.dailyAverage).toLocaleString()} ${unit}`}
      </td>
      <td>{none ? "—" : `${Math.round(stat.total).toLocaleString()} ${unit}`}</td>
      <td>{none ? "none" : `${pct}%`}</td>
    </tr>
  );
}

function CoverageNote({ label, stat }: { label: string; stat: PartialStat }) {
  const d = describeCoverage(stat);
  if (d.label === "complete") return null;
  return (
    <p className="muted-ink text-[11px]">
      <strong>{label}:</strong> {d.wording}
    </p>
  );
}

/** Plain-text version, for pasting into a patient portal or an email. */
function reportAsText(
  r: MonthlyReport,
  name: string,
  unit: string,
  month: Date,
): string {
  const line = (label: string, value: string) => `${label.padEnd(24)}${value}`;

  const partial = (label: string, stat: PartialStat, u: string) => {
    if (stat.entriesWithData === 0) return line(label, "not recorded");
    const prefix = stat.coverage >= 0.995 ? "" : "at least ";
    return line(
      label,
      `${prefix}${Math.round(stat.dailyAverage).toLocaleString()} ${u}/day (${Math.round(stat.coverage * 100)}% coverage)`,
    );
  };

  return [
    `NUTRITION AND WEIGHT REPORT — ${format(month, "MMMM yyyy")}`,
    name ? `Patient: ${name}` : "",
    `Prepared: ${format(new Date(), "MMMM d, yyyy")}`,
    `Days logged: ${r.daysLogged} of ${r.daysInMonth} (${r.entriesTotal} food entries)`,
    "",
    "HOW TO READ THIS",
    "Self-reported food logging, not measurement. Portions are estimated.",
    "Sugar, saturated fat, cholesterol and sodium are only recorded when a",
    "food's label listed them; coverage shows the share of calories included,",
    "and any figure under 100% coverage is a minimum, not an average.",
    "",
    "WEIGHT",
    line("Weigh-ins", String(r.weight.entries)),
    line("First", r.weight.start != null ? `${formatWeight(r.weight.start)} ${unit}` : "—"),
    line("Last", r.weight.end != null ? `${formatWeight(r.weight.end)} ${unit}` : "—"),
    line(
      "Change",
      r.weight.change != null
        ? `${r.weight.change >= 0 ? "+" : ""}${formatWeight(r.weight.change)} ${unit}`
        : "—",
    ),
    "",
    "DAILY INTAKE (complete data, per logged day)",
    line("Calories", `${Math.round(r.calories.dailyAverage).toLocaleString()} kcal`),
    line("Protein", `${formatMacro(r.protein.dailyAverage)} g`),
    line("Fat", `${formatMacro(r.fat.dailyAverage)} g`),
    line("Carbohydrate", `${formatMacro(r.carbs.dailyAverage)} g`),
    line("Fiber", `${formatMacro(r.fiber.dailyAverage)} g`),
    "",
    "DAILY INTAKE (partial data)",
    partial("Sugar", r.sugar, "g"),
    partial("Saturated fat", r.saturatedFat, "g"),
    partial("Cholesterol", r.cholesterolMg, "mg"),
    partial("Sodium", r.sodiumMg, "mg"),
    "",
    `Daily targets: ${formatCalories(r.targets.calories)} kcal, ${formatMacro(r.targets.protein)} g protein, ${formatMacro(r.targets.fat)} g fat.`,
    `Calorie target met on ${r.calorieTargetDays} of ${r.daysLogged} logged days.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}
