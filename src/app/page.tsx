"use client";

import { Card, SectionLabel } from "@/components/ui/card";
import { DEFAULT_TARGETS } from "@/lib/constants";
import { useMounted } from "@/lib/use-mounted";

/**
 * Today — the default screen.
 *
 * Phase 0 renders the real header and an empty calorie card so the token
 * system is proven end to end. Logging, meal sections and the macro cards
 * arrive in Phase 2.
 */
export default function TodayPage() {
  // Read the clock only after mount — the server has no idea what time it is
  // here, and rendering its guess would mismatch on hydration.
  const now = useMounted() ? new Date() : null;

  const consumed = 0;
  const target = DEFAULT_TARGETS.calories;
  const pct = Math.min(100, Math.round((consumed / target) * 100));
  const remaining = target - consumed;

  return (
    <main className="mx-auto max-w-lg">
      <header className="px-5 pb-5 pt-9">
        <h1 className="text-[26px] font-[650] leading-tight tracking-tight text-foreground">
          {now ? greeting(now) : " "}
        </h1>
        <p className="mt-1 text-sm text-secondary">
          {now
            ? now.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : " "}
        </p>
      </header>

      <div className="px-4">
        <Card className="px-5 py-6">
          <SectionLabel>Today</SectionLabel>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="metric text-[44px] font-[650] leading-none text-foreground">
              {consumed.toLocaleString()}
            </span>
            <span className="text-[15px] text-muted">
              of {target.toLocaleString()} calories
            </span>
          </div>

          <div className="progress-track mt-5 h-2.5 w-full">
            <div
              className="progress-fill progress-calories"
              style={{ width: `${Math.max(pct, 1.5)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="metric text-[13px] text-muted">{pct}%</span>
            <span className="metric text-[13px] text-blue">
              {remaining.toLocaleString()} remaining
            </span>
          </div>
        </Card>

        <p className="mt-6 px-1 text-[13px] leading-relaxed text-muted">
          Food logging, macro cards and meal sections arrive in Phase 2. The
          nutrition engine lands first, in Phase 1, so the math is right before
          anything depends on it.
        </p>
      </div>
    </main>
  );
}

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning, Jorge";
  if (h < 18) return "Good afternoon, Jorge";
  return "Good evening, Jorge";
}
