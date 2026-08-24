import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { profileInputSchema, type ProfileInput } from "@/lib/schemas";
import { DEFAULT_TARGETS, GOAL } from "@/lib/constants";
import { todayKey } from "@/lib/dates";
import type { MacroTargets, Profile } from "@/types";

const PROFILE = "profile";

export async function getProfile(userId: string): Promise<Profile | null> {
  const snap = await getDoc(doc(getDb(), PROFILE, userId));
  return snap.exists() ? ({ userId, ...snap.data() } as Profile) : null;
}

export async function saveProfile(
  userId: string,
  input: ProfileInput,
): Promise<void> {
  const parsed = profileInputSchema.parse(input);
  await setDoc(
    doc(getDb(), PROFILE, userId),
    { ...parsed, userId, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/** Targets to fall back on before a profile exists. */
export function defaultProfileInput(name = "Jorge"): ProfileInput {
  return {
    name,
    startingWeight: GOAL.startingWeight,
    goalWeight: GOAL.goalWeight,
    startingDate: todayKey(),
    targetDate: null,
    heightInches: null,
    birthDate: null,
    sex: null,
    activityLevel: "moderate",
    workoutDaysPerWeek: 3,
    weightUnit: "lb",
    dailyCalorieTarget: DEFAULT_TARGETS.calories,
    dailyProteinTarget: DEFAULT_TARGETS.protein,
    dailyFatTarget: DEFAULT_TARGETS.fat,
  };
}

export function targetsFrom(profile: Profile | null): MacroTargets {
  if (!profile) return { ...DEFAULT_TARGETS };
  return {
    calories: profile.dailyCalorieTarget,
    protein: profile.dailyProteinTarget,
    fat: profile.dailyFatTarget,
  };
}
