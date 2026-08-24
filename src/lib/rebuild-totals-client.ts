"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { dayStatus, sumMacros } from "./nutrition";
import type { FoodLog, MacroTargets } from "@/types";

/**
 * Rebuild every dailyTotals document from the food logs.
 *
 * `dailyTotals` is a cache, and a cache can go stale. It did: for a period,
 * the query behind rebuildDailyTotals needed a Firestore index that had never
 * been declared, so the recompute threw on every write. Foods still saved —
 * they are written first — but the day's totals silently stopped updating,
 * which means the calendar, the weekly averages and the report could all be
 * reading numbers that no longer match the logs.
 *
 * This recomputes the lot from the source of truth. The Admin-SDK script does
 * the same thing, but needs a service-account key; this runs as the signed-in
 * owner and needs nothing extra.
 */
export async function rebuildAllDailyTotals(
  userId: string,
  targets: MacroTargets,
): Promise<{ days: number; entries: number; corrected: number }> {
  const db = getDb();

  // One equality filter, so no composite index is involved — deliberately,
  // given that an index is what broke this in the first place.
  const logsSnap = await getDocs(
    query(collection(db, "foodLogs"), where("userId", "==", userId)),
  );
  const logs = logsSnap.docs.map((d) => d.data() as FoodLog);

  const byDate = new Map<string, FoodLog[]>();
  for (const log of logs) {
    const list = byDate.get(log.logDate) ?? [];
    list.push(log);
    byDate.set(log.logDate, list);
  }

  // Existing cache, so days whose logs were all deleted can be cleaned up too.
  const totalsSnap = await getDocs(
    query(collection(db, "dailyTotals"), where("userId", "==", userId)),
  );
  const existing = new Map<string, { calories: number }>();
  for (const d of totalsSnap.docs) {
    const data = d.data() as { date: string; calories: number };
    existing.set(data.date, { calories: data.calories ?? 0 });
  }

  const now = new Date().toISOString();
  let corrected = 0;
  const writes: { date: string; payload: Record<string, unknown> | null }[] = [];

  for (const [date, dayLogs] of byDate) {
    const totals = sumMacros(
      dayLogs.map((l) => ({
        calories: l.caloriesSnapshot,
        protein: l.proteinSnapshot,
        fat: l.fatSnapshot,
        carbs: l.carbsSnapshot,
        fiber: l.fiberSnapshot,
      })),
    );

    const before = existing.get(date);
    if (!before || Math.abs(before.calories - totals.calories) > 0.5) {
      corrected++;
    }

    writes.push({
      date,
      payload: {
        userId,
        date,
        ...totals,
        entryCount: dayLogs.length,
        status: dayStatus(totals.calories, targets.calories, dayLogs.length > 0),
        updatedAt: now,
      },
    });
  }

  // A cached day with no logs behind it any more is stale by definition.
  for (const [date] of existing) {
    if (!byDate.has(date)) {
      corrected++;
      writes.push({
        date,
        payload: {
          userId,
          date,
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          fiber: 0,
          entryCount: 0,
          status: "none",
          updatedAt: now,
        },
      });
    }
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + 400)) {
      batch.set(doc(db, "dailyTotals", w.date), w.payload!);
    }
    await batch.commit();
  }

  return { days: byDate.size, entries: logs.length, corrected };
}
