import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { DateKey } from "@/lib/dates";
import type { DailyTotals } from "@/types";

const TOTALS = "dailyTotals";

/**
 * Read side of the derived cache. Writes live in `food-logs.ts`, next to the
 * mutations that invalidate them, so there is exactly one place that can
 * produce a DailyTotals record.
 */

export async function getDailyTotals(
  date: DateKey,
): Promise<DailyTotals | null> {
  const snap = await getDoc(doc(getDb(), TOTALS, date));
  return snap.exists() ? (snap.data() as DailyTotals) : null;
}

/**
 * A date range in one query — this is why the cache exists. The calendar
 * would otherwise read every log of every day just to render a month grid.
 */
export async function listDailyTotals(
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<DailyTotals[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), TOTALS),
      where("userId", "==", userId),
      where("date", ">=", from),
      where("date", "<=", to),
      orderBy("date", "asc"),
    ),
  );
  return snap.docs.map((d) => d.data() as DailyTotals);
}
