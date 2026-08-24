import { describe, expect, it } from "vitest";
import {
  extractPer100g,
  macrosForGrams,
  mapDetail,
  mapSearchHits,
  titleCase,
  toFoodInput,
} from "./usda";
import { foodInputSchema } from "./schemas";

/** Shape of an SR Legacy record: nutrients per 100 g, plus portions. */
const SR_LEGACY = {
  fdcId: 173410,
  description: "PORK CHOP, BONELESS, COOKED",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrientNumber: "208", amount: 204 },
    { nutrientNumber: "203", amount: 27.9 },
    { nutrientNumber: "204", amount: 9.5 },
    { nutrientNumber: "205", amount: 0 },
    { nutrientNumber: "291", amount: 0 },
  ],
  foodPortions: [
    { gramWeight: 113, amount: 4, measureUnit: { name: "oz" } },
    { gramWeight: 85, amount: 3, measureUnit: { name: "oz" } },
  ],
};

/** Shape of a Branded record: labelNutrients are already per serving. */
const BRANDED = {
  fdcId: 999999,
  description: "GREEK YOGURT, VANILLA",
  brandName: "Ratio",
  dataType: "Branded",
  servingSize: 150,
  servingSizeUnit: "g",
  householdServingFullText: "1 container",
  labelNutrients: {
    calories: { value: 150 },
    protein: { value: 25 },
    fat: { value: 3 },
    carbohydrates: { value: 6 },
    fiber: { value: 0 },
  },
  foodNutrients: [
    { nutrientNumber: "208", amount: 100 },
    { nutrientNumber: "203", amount: 16.7 },
  ],
};

describe("extractPer100g", () => {
  it("pulls the five macros", () => {
    const m = extractPer100g(SR_LEGACY.foodNutrients)!;
    expect(m.calories).toBe(204);
    expect(m.protein).toBe(27.9);
    expect(m.fat).toBe(9.5);
  });

  it("handles the nested nutrient shape the detail endpoint returns", () => {
    const m = extractPer100g([
      { nutrient: { number: "208" }, amount: 120 },
      { nutrient: { number: "203" }, amount: 8 },
    ])!;
    expect(m.calories).toBe(120);
    expect(m.protein).toBe(8);
  });

  it("returns null without an energy value, rather than guessing zero", () => {
    expect(extractPer100g([{ nutrientNumber: "203", amount: 10 }])).toBeNull();
  });

  it("defaults missing non-energy macros to zero", () => {
    const m = extractPer100g([{ nutrientNumber: "208", amount: 50 }])!;
    expect(m.protein).toBe(0);
    expect(m.fiber).toBe(0);
  });
});

describe("macrosForGrams", () => {
  it("scales per-100g values", () => {
    const per100 = { calories: 204, protein: 27.9, fat: 9.5, carbs: 0, fiber: 0 };
    const m = macrosForGrams(per100, 113);
    expect(m.calories).toBeCloseTo(230.52, 2);
    expect(m.protein).toBeCloseTo(31.53, 2);
  });

  it("is the identity at 100 g", () => {
    const per100 = { calories: 204, protein: 27.9, fat: 9.5, carbs: 1, fiber: 2 };
    expect(macrosForGrams(per100, 100)).toEqual(per100);
  });
});

describe("mapDetail", () => {
  it("maps an SR Legacy food with its portions", () => {
    const d = mapDetail(SR_LEGACY);
    expect(d.per100g?.calories).toBe(204);
    expect(d.labelServing).toBeNull();
    expect(d.servingOptions).toContainEqual({ description: "4 oz", grams: 113 });
    // 100 g is always offered so there is a usable option.
    expect(d.servingOptions).toContainEqual({ description: "100 g", grams: 100 });
  });

  it("uses label values for a branded food", () => {
    const d = mapDetail(BRANDED);
    expect(d.brand).toBe("Ratio");
    expect(d.labelServing?.calories).toBe(150);
    expect(d.labelServing?.description).toBe("1 container");
    expect(d.labelServing?.grams).toBe(150);
    expect(d.servingOptions[0].description).toBe("1 container");
  });

  it("does not claim a gram weight when the serving is not measured in grams", () => {
    const d = mapDetail({
      ...BRANDED,
      servingSizeUnit: "ml",
      householdServingFullText: "1 cup",
    });
    expect(d.labelServing?.grams).toBeNull();
  });

  it("drops portions with no gram weight", () => {
    const d = mapDetail({
      ...SR_LEGACY,
      foodPortions: [{ amount: 1, measureUnit: { name: "cup" } }],
    });
    expect(d.servingOptions).toEqual([{ description: "100 g", grams: 100 }]);
  });
});

describe("toFoodInput", () => {
  it("scales a generic food to the chosen portion", () => {
    const d = mapDetail(SR_LEGACY);
    const input = toFoodInput(d, { description: "4 oz", grams: 113 })!;

    expect(input.caloriesPerServing).toBe(231);
    expect(input.proteinPerServing).toBe(31.5);
    expect(input.servingWeightGrams).toBe(113);
    expect(input.verificationStatus).toBe("usda_verified");
    expect(input.dataSource).toBe("usda_generic");
    expect(input.externalFoodId).toBe("173410");
  });

  it("uses the label serving verbatim for a branded food", () => {
    const d = mapDetail(BRANDED);
    const input = toFoodInput(d, { description: "1 container", grams: 150 })!;

    // Straight off the package — not derived from the per-100g figures.
    expect(input.caloriesPerServing).toBe(150);
    expect(input.proteinPerServing).toBe(25);
    expect(input.dataSource).toBe("usda_branded");
  });

  it("produces something the schema accepts", () => {
    const d = mapDetail(SR_LEGACY);
    const input = toFoodInput(d, { description: "4 oz", grams: 113 })!;
    expect(foodInputSchema.safeParse(input).success).toBe(true);
  });

  it("returns null when there is nothing to compute from", () => {
    const d = mapDetail({ fdcId: 1, description: "MYSTERY", foodNutrients: [] });
    expect(toFoodInput(d, { description: "1 serving", grams: null })).toBeNull();
  });
});

describe("mapSearchHits", () => {
  it("normalizes results", () => {
    const hits = mapSearchHits({ foods: [SR_LEGACY, BRANDED] });
    expect(hits).toHaveLength(2);
    expect(hits[1].brand).toBe("Ratio");
    expect(hits[1].servingText).toBe("1 container");
  });

  it("survives an empty response", () => {
    expect(mapSearchHits({})).toEqual([]);
  });
});

describe("titleCase", () => {
  it("fixes USDA's shouting", () => {
    expect(titleCase("PORK CHOP, BONELESS")).toBe("Pork Chop, Boneless");
  });

  it("leaves already-cased names alone", () => {
    expect(titleCase("Eggland's Best Egg")).toBe("Eggland's Best Egg");
  });
});
