import type { FoodInput } from "./schemas";
import type { MacroSet } from "@/types";

/**
 * USDA FoodData Central mapping.
 *
 * Pure functions so the awkward part — turning USDA's two very different
 * shapes into one base serving — is testable without touching the network.
 *
 * Two shapes to handle:
 *   Branded    — `labelNutrients` are already PER SERVING, straight off the
 *                package. Best case: use them as-is.
 *   Foundation / SR Legacy
 *              — `foodNutrients` are PER 100 g, with `foodPortions` giving
 *                household measures and their gram weights.
 *
 * Getting this backwards would store per-100g numbers as if they were a
 * serving, which is the exact class of error this app exists to prevent.
 */

/** USDA nutrient numbers. */
const N = {
  protein: "203",
  fat: "204",
  carbs: "205",
  calories: "208",
  fiber: "291",
  sugar: "269",
  saturatedFat: "606",
  cholesterol: "601",
  sodium: "307",
  potassium: "306",
} as const;

export type UsdaSearchHit = {
  fdcId: number;
  description: string;
  brand: string | null;
  dataType: string;
  servingText: string | null;
};

export type ServingOption = {
  description: string;
  /** Null when USDA gives a measure with no gram weight. */
  grams: number | null;
};

/** The secondary label values, per 100 g or per serving depending on source. */
export type ExtendedValues = {
  sugar: number | null;
  saturatedFat: number | null;
  cholesterolMg: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
};

export type UsdaFoodDetail = {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string;
  /** Present for Foundation / SR Legacy foods. */
  per100g: MacroSet | null;
  /** Secondary values per 100 g, for the same foods as `per100g`. */
  extendedPer100g: ExtendedValues;
  /** Present for Branded foods, taken from the label. */
  labelServing:
    | (MacroSet & ExtendedValues & { description: string; grams: number | null })
    | null;
  servingOptions: ServingOption[];
};

type RawNutrient = {
  nutrientNumber?: string;
  nutrient?: { number?: string };
  amount?: number;
  value?: number;
};

/** Pull the five macros out of a per-100g nutrient array. */
export function extractPer100g(nutrients: RawNutrient[]): MacroSet | null {
  const get = (num: string): number | null => {
    const hit = nutrients.find(
      (n) => (n.nutrientNumber ?? n.nutrient?.number) === num,
    );
    const value = hit?.amount ?? hit?.value;
    return typeof value === "number" ? value : null;
  };

  const calories = get(N.calories);
  if (calories == null) return null;

  return {
    calories,
    protein: get(N.protein) ?? 0,
    fat: get(N.fat) ?? 0,
    carbs: get(N.carbs) ?? 0,
    fiber: get(N.fiber) ?? 0,
  };
}

/** Pull the secondary values, leaving anything absent as null. */
export function extractExtended(nutrients: RawNutrient[]): ExtendedValues {
  const get = (num: string): number | null => {
    const hit = nutrients.find(
      (n) => (n.nutrientNumber ?? n.nutrient?.number) === num,
    );
    const value = hit?.amount ?? hit?.value;
    return typeof value === "number" ? value : null;
  };

  return {
    sugar: get(N.sugar),
    saturatedFat: get(N.saturatedFat),
    cholesterolMg: get(N.cholesterol),
    sodiumMg: get(N.sodium),
    potassiumMg: get(N.potassium),
  };
}

/** Scale the secondary values, keeping unknowns unknown. */
export function extendedForGrams(
  per100g: ExtendedValues,
  grams: number,
): ExtendedValues {
  const f = grams / 100;
  const scale = (v: number | null) => (v == null ? null : v * f);
  return {
    sugar: scale(per100g.sugar),
    saturatedFat: scale(per100g.saturatedFat),
    cholesterolMg: scale(per100g.cholesterolMg),
    sodiumMg: scale(per100g.sodiumMg),
    potassiumMg: scale(per100g.potassiumMg),
  };
}

/** Scale per-100g values to an arbitrary gram weight. */
export function macrosForGrams(per100g: MacroSet, grams: number): MacroSet {
  const factor = grams / 100;
  return {
    calories: per100g.calories * factor,
    protein: per100g.protein * factor,
    fat: per100g.fat * factor,
    carbs: per100g.carbs * factor,
    fiber: per100g.fiber * factor,
  };
}

type RawDetail = {
  fdcId: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  labelNutrients?: Record<string, { value?: number } | undefined>;
  foodNutrients?: RawNutrient[];
  foodPortions?: {
    gramWeight?: number;
    amount?: number;
    modifier?: string;
    measureUnit?: { name?: string };
    portionDescription?: string;
  }[];
};

export function mapDetail(raw: RawDetail): UsdaFoodDetail {
  const brand = raw.brandName ?? raw.brandOwner ?? null;
  const dataType = raw.dataType ?? "Unknown";

  const per100g = extractPer100g(raw.foodNutrients ?? []);
  const extendedPer100g = extractExtended(raw.foodNutrients ?? []);

  // Branded foods carry the label values directly, per serving.
  let labelServing: UsdaFoodDetail["labelServing"] = null;
  const ln = raw.labelNutrients;
  if (ln && typeof ln.calories?.value === "number") {
    const grams =
      raw.servingSizeUnit?.toLowerCase() === "g" && raw.servingSize
        ? raw.servingSize
        : null;

    labelServing = {
      description:
        raw.householdServingFullText ??
        (raw.servingSize
          ? `${raw.servingSize} ${raw.servingSizeUnit ?? "g"}`
          : "1 serving"),
      grams,
      calories: ln.calories.value,
      protein: ln.protein?.value ?? 0,
      fat: ln.fat?.value ?? 0,
      carbs: ln.carbohydrates?.value ?? 0,
      fiber: ln.fiber?.value ?? 0,
      // Absent on the label means unknown, not zero.
      sugar: ln.sugars?.value ?? null,
      saturatedFat: ln.saturatedFat?.value ?? null,
      cholesterolMg: ln.cholesterol?.value ?? null,
      sodiumMg: ln.sodium?.value ?? null,
      potassiumMg: ln.potassium?.value ?? null,
    };
  }

  const servingOptions: ServingOption[] = [];

  if (labelServing) {
    servingOptions.push({
      description: labelServing.description,
      grams: labelServing.grams,
    });
  }

  for (const p of raw.foodPortions ?? []) {
    if (!p.gramWeight) continue;
    const amount = p.amount ?? 1;
    const unit = p.measureUnit?.name && p.measureUnit.name !== "undetermined"
      ? p.measureUnit.name
      : (p.modifier ?? p.portionDescription ?? "portion");
    servingOptions.push({
      description: `${amount} ${unit}`.trim(),
      grams: p.gramWeight,
    });
  }

  // 100 g is always a legitimate serving and guarantees a usable option.
  if (per100g) servingOptions.push({ description: "100 g", grams: 100 });

  return {
    fdcId: raw.fdcId,
    name: raw.description ?? "Unknown food",
    brand,
    dataType,
    per100g,
    extendedPer100g,
    labelServing,
    servingOptions: dedupe(servingOptions),
  };
}

export function mapSearchHits(raw: {
  foods?: RawDetail[];
}): UsdaSearchHit[] {
  return (raw.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    description: f.description ?? "Unknown food",
    brand: f.brandName ?? f.brandOwner ?? null,
    dataType: f.dataType ?? "Unknown",
    servingText:
      f.householdServingFullText ??
      (f.servingSize ? `${f.servingSize} ${f.servingSizeUnit ?? "g"}` : null),
  }));
}

/**
 * Turn a USDA food plus a chosen serving into a FoodInput.
 *
 * Every result is `usda_verified` and keeps its fdcId, so a food can always be
 * traced back to the record it came from.
 */
export function toFoodInput(
  detail: UsdaFoodDetail,
  option: ServingOption,
): FoodInput | null {
  let macros: MacroSet | null = null;
  let extra: ExtendedValues = {
    sugar: null,
    saturatedFat: null,
    cholesterolMg: null,
    sodiumMg: null,
    potassiumMg: null,
  };

  // Prefer the label's own serving when that is what was picked.
  if (
    detail.labelServing &&
    option.description === detail.labelServing.description
  ) {
    macros = detail.labelServing;
    extra = detail.labelServing;
  } else if (detail.per100g && option.grams != null) {
    macros = macrosForGrams(detail.per100g, option.grams);
    extra = extendedForGrams(detail.extendedPer100g, option.grams);
  } else if (detail.labelServing) {
    macros = detail.labelServing;
    extra = detail.labelServing;
  }

  if (!macros) return null;

  const round1 = (v: number | null) => (v == null ? null : round(v, 1));

  return {
    name: titleCase(detail.name),
    brand: detail.brand,
    category: "mixed",
    servingDescription: option.description,
    servingAmount: 1,
    servingUnit: option.description,
    servingWeightGrams: option.grams,
    caloriesPerServing: round(macros.calories, 0),
    proteinPerServing: round(macros.protein, 1),
    fatPerServing: round(macros.fat, 1),
    carbsPerServing: round(macros.carbs, 1),
    fiberPerServing: round(macros.fiber, 1),
    sugarPerServing: round1(extra.sugar),
    saturatedFatPerServing: round1(extra.saturatedFat),
    cholesterolMgPerServing: round1(extra.cholesterolMg),
    sodiumMgPerServing: round1(extra.sodiumMg),
    potassiumMgPerServing: round1(extra.potassiumMg),
    dataSource: detail.dataType === "Branded" ? "usda_branded" : "usda_generic",
    externalFoodId: String(detail.fdcId),
    verificationStatus: "usda_verified",
    confidenceScore: null,
    labelImageUrl: null,
    isFavorite: false,
    isActive: true,
  };
}

function dedupe(options: ServingOption[]): ServingOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = `${o.description}|${o.grams}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** USDA descriptions are SHOUTED; make them readable. */
export function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
