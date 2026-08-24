import type {
  DayStatus,
  ExtendedNutrition,
  MacroSet,
  MacroTargets,
  ServingNutrition,
} from "@/types";

/**
 * THE calculation engine.
 *
 * Every macro number in this app comes from here. No component, route or
 * script may compute totals inline — that is exactly how the Notion tracker
 * ended up with serving values and totals that disagreed with each other.
 *
 * The rule: a food stores nutrition for ONE base serving. Totals are always
 * that value multiplied by a quantity. Nobody ever types a total.
 */

export const EMPTY_MACROS: MacroSet = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  fiber: 0,
};

/**
 * Totals for `quantity` servings of a food.
 *
 *   totalCalories = caloriesPerServing × quantity
 *
 * Throws on nonsense input rather than quietly producing NaN — a wrong number
 * that looks like a number is the failure mode this whole app exists to avoid.
 */
export function computeLogMacros(
  food: ServingNutrition,
  quantity: number,
): MacroSet {
  assertFinite(quantity, "quantity");
  if (quantity < 0) {
    throw new RangeError(`quantity must not be negative, got ${quantity}`);
  }

  assertFinite(food.caloriesPerServing, "caloriesPerServing");
  assertFinite(food.proteinPerServing, "proteinPerServing");
  assertFinite(food.fatPerServing, "fatPerServing");
  assertFinite(food.carbsPerServing, "carbsPerServing");
  assertFinite(food.fiberPerServing, "fiberPerServing");

  return {
    calories: food.caloriesPerServing * quantity,
    protein: food.proteinPerServing * quantity,
    fat: food.fatPerServing * quantity,
    carbs: food.carbsPerServing * quantity,
    fiber: food.fiberPerServing * quantity,
  };
}

/**
 * Scale the secondary label values, preserving "unknown".
 *
 * Null in means null out. Treating an absent sodium figure as 0 would let a
 * day of unlabelled foods report a confidently low total — the same species
 * of quiet wrongness as a mistyped serving size.
 */
export type ExtendedMacros = {
  sugar: number | null;
  saturatedFat: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
};

export function computeExtendedMacros(
  food: ExtendedNutrition,
  quantity: number,
): ExtendedMacros {
  assertFinite(quantity, "quantity");
  const scale = (v: number | null) => (v == null ? null : v * quantity);

  return {
    sugar: scale(food.sugarPerServing),
    saturatedFat: scale(food.saturatedFatPerServing),
    cholesterolMg: scale(food.cholesterolMgPerServing),
    sodiumMg: scale(food.sodiumMgPerServing),
  };
}

/**
 * Convert a weighed portion into a number of servings.
 *
 *   servingsConsumed = gramsConsumed ÷ gramsPerServing
 *
 * Feed the result straight into computeLogMacros — never scale macros here.
 */
export function gramsToServings(
  grams: number,
  servingWeightGrams: number | null,
): number {
  assertFinite(grams, "grams");
  if (grams < 0) {
    throw new RangeError(`grams must not be negative, got ${grams}`);
  }
  if (servingWeightGrams == null || servingWeightGrams <= 0) {
    throw new RangeError(
      "Cannot convert grams to servings: this food has no serving weight. " +
        "Add servingWeightGrams before logging it by weight.",
    );
  }
  return grams / servingWeightGrams;
}

/** Add up any collection of macro sets. */
export function sumMacros(sets: readonly Partial<MacroSet>[]): MacroSet {
  return sets.reduce<MacroSet>(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      fat: acc.fat + (m.fat ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fiber: acc.fiber + (m.fiber ?? 0),
    }),
    { ...EMPTY_MACROS },
  );
}

/**
 * How much is left against the day's targets.
 *
 * Values go negative past the target, and that is fine — the caller decides
 * how to present it. Calories past target are a surplus, not an overage.
 */
export function remaining(
  totals: Pick<MacroSet, "calories" | "protein" | "fat">,
  targets: MacroTargets,
): MacroTargets {
  return {
    calories: targets.calories - totals.calories,
    protein: targets.protein - totals.protein,
    fat: targets.fat - totals.fat,
  };
}

/** Fraction of target consumed, clamped at 0. 1 means exactly on target. */
export function progressRatio(consumed: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, consumed / target);
}

/** Percentage for progress bars, capped at 100 so the fill cannot overflow. */
export function progressPercent(consumed: number, target: number): number {
  return Math.min(100, progressRatio(consumed, target) * 100);
}

/**
 * Calendar and dashboard status thresholds:
 *
 *   < 90%        below     red
 *   90 – 99.99%  near      amber
 *   100 – 115%   ontarget  green
 *   > 115%       surplus   orange
 *   no entries   none      gray
 */
export function dayStatus(
  calories: number,
  target: number,
  hasEntries: boolean = calories > 0,
): DayStatus {
  if (!hasEntries) return "none";
  const ratio = progressRatio(calories, target);
  if (ratio < 0.9) return "below";
  if (ratio < 1) return "near";
  if (ratio <= 1.15) return "ontarget";
  return "surplus";
}

/**
 * How much of a batch ingredient ends up in one portion.
 *
 *   portionQuantity = batchQuantity x portionsEaten / servingsPrepared
 *
 * This exists because of cooking oil. A tablespoon in the pan that cooks four
 * bowls puts a quarter tablespoon in each — roughly 30 calories and 3.4 g of
 * fat, not 119 and 13.5. Recording the whole tablespoon against every bowl
 * overstates the day by nearly 360 calories, and recording none of it
 * understates a real and easily-missed source of fat.
 *
 * The same applies to salt and seasoning blends, where the miscount lands on
 * sodium rather than calories.
 */
export function portionQuantity(
  batchQuantity: number,
  portionsEaten: number,
  servingsPrepared: number,
): number {
  assertFinite(batchQuantity, "batchQuantity");
  assertFinite(portionsEaten, "portionsEaten");
  assertFinite(servingsPrepared, "servingsPrepared");

  if (servingsPrepared <= 0) {
    throw new RangeError(
      `servingsPrepared must be greater than zero, got ${servingsPrepared}`,
    );
  }

  return (batchQuantity * portionsEaten) / servingsPrepared;
}

/**
 * Carbohydrate target, derived rather than configured.
 *
 * Protein and fat are set for their own reasons — muscle synthesis and
 * hormonal floor. Carbohydrate is what fills the calories those two leave
 * behind, so a separate carb setting would only ever be a fourth number that
 * could contradict the other three. Deriving it keeps them consistent by
 * construction:
 *
 *   carbTarget = (calories - protein x 4 - fat x 9) / 4
 *
 * Returns 0 rather than a negative when protein and fat alone already exceed
 * the calorie target — an impossible target, not a negative one.
 */
export function carbTarget(targets: MacroTargets): number {
  const remainingCalories =
    targets.calories - targets.protein * 4 - targets.fat * 9;
  return Math.max(0, remainingCalories / 4);
}

/** True once the calorie target is met — the moment blue becomes green. */
export function isTargetReached(consumed: number, target: number): boolean {
  return target > 0 && consumed >= target;
}

/**
 * Daily surplus against maintenance. Positive means gaining.
 * Roughly 3,500 kcal per pound of body mass.
 */
export const CALORIES_PER_POUND = 3500;

/** Projected weekly weight change, in pounds, from an average daily surplus. */
export function projectedWeeklyGain(averageDailySurplus: number): number {
  return (averageDailySurplus * 7) / CALORIES_PER_POUND;
}

/* -------------------------------------------------------------------------
   Display formatting.

   Rounding happens HERE and nowhere else. Stored and intermediate values stay
   at full precision so that summing many logs never accumulates rounding drift.
   ------------------------------------------------------------------------- */

/** Calories always read as whole numbers, with a thousands separator. */
export function formatCalories(value: number): string {
  return Math.round(value).toLocaleString();
}

/** Macros read to one decimal, trailing ".0" dropped: 12.6 g, 13 g. */
export function formatMacro(value: number, decimals = 1): string {
  const rounded =
    Math.round(value * 10 ** decimals) / 10 ** decimals;
  return String(rounded);
}

/** Weight to one decimal — 144.2 lb. */
export function formatWeight(value: number): string {
  return value.toFixed(1);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function assertFinite(value: number, field: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number, got ${value}`);
  }
}

/**
 * Trailing average over the last `window` values.
 *
 * The seven-day weight average is the number that matters on the Progress
 * screen — daily weight swings by pounds on water alone and cannot be read
 * as progress. Returns null when there is nothing to average.
 */
export function trailingAverage(
  values: readonly number[],
  window = 7,
): number | null {
  if (values.length === 0) return null;
  const slice = values.slice(-window);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}
