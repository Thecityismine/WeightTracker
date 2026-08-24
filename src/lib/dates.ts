import { addDays, format, parse, startOfWeek } from "date-fns";

/**
 * Dates are stored as YYYY-MM-DD strings in the user's LOCAL timezone.
 *
 * Never use toISOString() for a log date. It converts to UTC, so anything
 * logged after 7pm Eastern would land on tomorrow's date — silently moving
 * dinner into the next day and wrecking the daily totals.
 */
export type DateKey = string;

export function toDateKey(date: Date): DateKey {
  return format(date, "yyyy-MM-dd");
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

export function fromDateKey(key: DateKey): Date {
  return parse(key, "yyyy-MM-dd", new Date());
}

export function shiftDateKey(key: DateKey, days: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), days));
}

export function yesterdayKey(key: DateKey = todayKey()): DateKey {
  return shiftDateKey(key, -1);
}

export function isToday(key: DateKey): boolean {
  return key === todayKey();
}

/** Seven date keys, Sunday through Saturday, containing `key`. */
export function weekKeys(key: DateKey, weekStartsOn: 0 | 1 = 0): DateKey[] {
  const start = startOfWeek(fromDateKey(key), { weekStartsOn });
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

/** Inclusive range of date keys. */
export function dateKeyRange(from: DateKey, to: DateKey): DateKey[] {
  const keys: DateKey[] = [];
  let cursor = from;
  // Guard against an inverted range looping forever.
  for (let i = 0; i < 400 && cursor <= to; i++) {
    keys.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return keys;
}

/** "Sunday, August 23" */
export function formatLongDate(key: DateKey): string {
  return format(fromDateKey(key), "EEEE, MMMM d");
}

/** Whole days since a start date, inclusive of today — the "Day 12" counter. */
export function daysSince(startKey: DateKey, endKey: DateKey = todayKey()): number {
  const ms = fromDateKey(endKey).getTime() - fromDateKey(startKey).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}
