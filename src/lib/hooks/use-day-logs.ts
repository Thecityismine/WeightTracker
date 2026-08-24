"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { DateKey } from "@/lib/dates";
import type { FoodLog } from "@/types";

type State = { key: string; logs: FoodLog[]; error: Error | null };

/**
 * Live subscription to one day's food logs.
 *
 * onSnapshot rather than a one-shot read: with Firestore's offline cache this
 * renders instantly from disk, updates the moment a write lands, and keeps
 * working with no connection.
 *
 * Loading is derived from whether the delivered data matches the requested
 * key, so switching dates never briefly shows the previous day's food.
 */
export function useDayLogs(userId: string | null, date: DateKey) {
  const key = `${userId ?? ""}|${date}`;
  const [state, setState] = useState<State>({
    key: "",
    logs: [],
    error: null,
  });

  useEffect(() => {
    if (!userId) return;

    // Sorted client-side by createdAt so this needs no composite index
    // beyond userId + logDate.
    const q = query(
      collection(getDb(), "foodLogs"),
      where("userId", "==", userId),
      where("logDate", "==", date),
    );

    return onSnapshot(
      q,
      (snap) => {
        const logs = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as FoodLog,
        );
        logs.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
        setState({ key, logs, error: null });
      },
      (error) => setState({ key, logs: [], error }),
    );
  }, [userId, date, key]);

  const ready = state.key === key;
  return {
    logs: ready ? state.logs : [],
    loading: !ready,
    error: ready ? state.error : null,
  };
}
