"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { trailingAverage } from "@/lib/nutrition";
import type { DateKey } from "@/lib/dates";
import type { WeightLog } from "@/types";

type State = { key: string; weights: WeightLog[] };

/**
 * Live weight history, oldest first.
 *
 * The seven-day average is the number that matters — daily weight moves by
 * pounds on water alone, so a single morning reading cannot be read as
 * progress. Everything downstream should prefer `average7`.
 */
export function useWeights(userId: string | null) {
  const key = userId ?? "";
  const [state, setState] = useState<State>({ key: "", weights: [] });

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(getDb(), "weightLogs"),
      where("userId", "==", userId),
    );

    return onSnapshot(
      q,
      (snap) => {
        const weights = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as WeightLog,
        );
        weights.sort((a, b) => a.date.localeCompare(b.date));
        setState({ key, weights });
      },
      () => setState({ key, weights: [] }),
    );
  }, [userId, key]);

  const ready = state.key === key;
  const weights = ready ? state.weights : [];

  const latest = weights.length ? weights[weights.length - 1] : null;
  const average7 = trailingAverage(
    weights.map((w) => w.weight),
    7,
  );

  return {
    weights,
    latest,
    average7,
    loading: !ready,
    forDate: (date: DateKey) => weights.find((w) => w.date === date) ?? null,
  };
}
