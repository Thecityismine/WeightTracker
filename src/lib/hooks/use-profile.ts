"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { DEFAULT_TARGETS } from "@/lib/constants";
import type { MacroTargets, Profile } from "@/types";

type State = { key: string; profile: Profile | null };

/**
 * Live profile, plus the day's targets.
 *
 * Targets fall back to the starting numbers until a profile is created in
 * Phase 4, so the Today screen is useful from the first login.
 */
export function useProfile(userId: string | null) {
  const key = userId ?? "";
  const [state, setState] = useState<State>({ key: "", profile: null });

  useEffect(() => {
    if (!userId) return;

    return onSnapshot(
      doc(getDb(), "profile", userId),
      (snap) =>
        setState({
          key,
          profile: snap.exists()
            ? ({ userId, ...snap.data() } as Profile)
            : null,
        }),
      () => setState({ key, profile: null }),
    );
  }, [userId, key]);

  const ready = state.key === key;
  const profile = ready ? state.profile : null;

  const targets: MacroTargets = profile
    ? {
        calories: profile.dailyCalorieTarget,
        protein: profile.dailyProteinTarget,
        fat: profile.dailyFatTarget,
      }
    : { ...DEFAULT_TARGETS };

  return { profile, targets, loading: !ready };
}
