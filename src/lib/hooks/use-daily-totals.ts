"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { DateKey } from "@/lib/dates";
import type { DailyTotals } from "@/types";

type State = { key: string; totals: Record<DateKey, DailyTotals> };

/**
 * Daily totals across a date range, keyed by date.
 *
 * This is what the cache exists for: rendering a month grid straight from
 * foodLogs would mean reading every log of every day just to show 30 numbers.
 */
export function useDailyTotals(
  userId: string | null,
  from: DateKey,
  to: DateKey,
) {
  const key = `${userId ?? ""}|${from}|${to}`;
  const [state, setState] = useState<State>({ key: "", totals: {} });

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(getDb(), "dailyTotals"),
      where("userId", "==", userId),
      where("date", ">=", from),
      where("date", "<=", to),
    );

    return onSnapshot(
      q,
      (snap) => {
        const totals: Record<DateKey, DailyTotals> = {};
        for (const d of snap.docs) {
          const row = d.data() as DailyTotals;
          totals[row.date] = row;
        }
        setState({ key, totals });
      },
      () => setState({ key, totals: {} }),
    );
  }, [userId, from, to, key]);

  const ready = state.key === key;
  return { totals: ready ? state.totals : {}, loading: !ready };
}
