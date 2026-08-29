import type { FoodInput } from "./schemas";

type Nutriments = Record<string, number | string | undefined>;

export type OpenFoodFactsResponse = {
  status?: number;
  product?: {
    code?: string;
    product_name?: string;
    generic_name?: string;
    brands?: string;
    serving_size?: string;
    serving_quantity?: number | string;
    nutriments?: Nutriments;
  };
};

/**
 * Convert Open Food Facts' normalized nutrient fields into one editable
 * serving. Community records are imports, not verified labels, so callers
 * must present the regular food form before saving.
 */
export function mapOpenFoodFactsProduct(
  raw: OpenFoodFactsResponse,
  barcode: string,
): FoodInput | null {
  if (raw.status !== 1 || !raw.product) return null;
  const product = raw.product;
  const nutrients = product.nutriments ?? {};
  const servingGrams = finite(product.serving_quantity);
  const factor = servingGrams != null ? servingGrams / 100 : null;

  const nutrient = (name: string): number | null => {
    const perServing = finite(nutrients[`${name}_serving`]);
    if (perServing != null) return perServing;
    const per100g = finite(nutrients[`${name}_100g`]);
    return per100g != null && factor != null ? per100g * factor : null;
  };

  const calories = nutrient("energy-kcal");
  const name = clean(product.product_name) ?? clean(product.generic_name);
  if (calories == null || !name) return null;

  const servingDescription = clean(product.serving_size) ??
    (servingGrams != null ? `${round(servingGrams, 1)} g` : "1 serving");
  const gramsToMg = (value: number | null) =>
    value == null ? null : round(value * 1000, 1);

  return {
    name,
    brand: clean(product.brands),
    category: "mixed",
    servingDescription,
    servingAmount: 1,
    servingUnit: "serving",
    servingWeightGrams: servingGrams,
    caloriesPerServing: round(calories, 0),
    proteinPerServing: round(nutrient("proteins") ?? 0, 1),
    fatPerServing: round(nutrient("fat") ?? 0, 1),
    carbsPerServing: round(nutrient("carbohydrates") ?? 0, 1),
    fiberPerServing: round(nutrient("fiber") ?? 0, 1),
    sugarPerServing: nullableRound(nutrient("sugars")),
    saturatedFatPerServing: nullableRound(nutrient("saturated-fat")),
    cholesterolMgPerServing: gramsToMg(nutrient("cholesterol")),
    sodiumMgPerServing: gramsToMg(nutrient("sodium")),
    potassiumMgPerServing: gramsToMg(nutrient("potassium")),
    dataSource: "open_food_facts",
    externalFoodId: barcode,
    verificationStatus: "barcode_imported",
    confidenceScore: null,
    labelImageUrl: null,
    isFavorite: false,
    isActive: true,
  };
}

function finite(value: number | string | undefined): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function nullableRound(value: number | null): number | null {
  return value == null ? null : round(value, 1);
}
