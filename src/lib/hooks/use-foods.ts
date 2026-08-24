"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Food } from "@/types";

type State = { key: string; foods: Food[] };

/**
 * Live subscription to the whole personal food database.
 *
 * Forty-odd foods is small enough to hold in memory, which makes search,
 * Recent and Favorites instant and offline-capable with no extra queries.
 */
export function useFoods(userId: string | null) {
  const key = userId ?? "";
  const [state, setState] = useState<State>({ key: "", foods: [] });

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(getDb(), "foods"),
      where("userId", "==", userId),
      where("isActive", "==", true),
    );

    return onSnapshot(
      q,
      (snap) =>
        setState({
          key,
          foods: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Food),
        }),
      () => setState({ key, foods: [] }),
    );
  }, [userId, key]);

  const ready = state.key === key;
  return { foods: ready ? state.foods : [], loading: !ready };
}

/** Most-used first, then alphabetical — the Recent tab's ordering. */
export function byUse(a: Food, b: Food): number {
  const diff = (b.useCount ?? 0) - (a.useCount ?? 0);
  return diff !== 0 ? diff : a.name.localeCompare(b.name);
}

export function searchFoods(foods: Food[], term: string): Food[] {
  const t = term.trim().toLowerCase();
  if (!t) return foods;
  return foods.filter(
    (f) =>
      f.name.toLowerCase().includes(t) ||
      (f.brand ?? "").toLowerCase().includes(t),
  );
}
