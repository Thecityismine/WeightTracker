/** Starting targets from the roadmap. Editable in Settings from Phase 4. */
export const DEFAULT_TARGETS = {
  calories: 2800,
  protein: 130,
  fat: 80,
} as const;

export const GOAL = {
  startingWeight: 144,
  goalWeight: 149,
  weeklyGainLow: 0.25,
  weeklyGainHigh: 0.5,
  unit: "lb",
} as const;

export const MEAL_CATEGORIES = [
  "breakfast",
  "lunch",
  "snack",
  "shake",
  "dinner",
] as const;

export type MealCategory = (typeof MEAL_CATEGORIES)[number];

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  shake: "Shake",
  dinner: "Dinner",
};
