"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { BodyComposition } from "@/types";

type State = { key: string; readings: BodyComposition[] };

/** Live body composition history, oldest first. */
export function useBodyComposition(userId: string | null) {
  const key = userId ?? "";
  const [state, setState] = useState<State>({ key: "", readings: [] });

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(getDb(), "bodyCompositions"),
      where("userId", "==", userId),
    );

    return onSnapshot(
      q,
      (snap) => {
        const readings = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as BodyComposition,
        );
        readings.sort((a, b) => a.date.localeCompare(b.date));
        setState({ key, readings });
      },
      () => setState({ key, readings: [] }),
    );
  }, [userId, key]);

  const ready = state.key === key;
  const readings = ready ? state.readings : [];

  return {
    readings,
    latest: readings.length ? readings[readings.length - 1] : null,
    previous: readings.length > 1 ? readings[readings.length - 2] : null,
    loading: !ready,
  };
}
