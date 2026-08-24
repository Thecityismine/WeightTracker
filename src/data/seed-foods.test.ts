import { describe, expect, it } from "vitest";
import { SEED_FOODS } from "./seed-foods";
import { foodInputSchema } from "@/lib/schemas";
import { computeLogMacros } from "@/lib/nutrition";

describe("seed foods", () => {
  it("has a useful starting set", () => {
    // The roadmap calls for the 30-50 foods actually eaten.
    expect(SEED_FOODS.length).toBeGreaterThanOrEqual(30);
    expect(SEED_FOODS.length).toBeLessThanOrEqual(60);
  });

  it("every food passes validation", () => {
    for (const food of SEED_FOODS) {
      const result = foodInputSchema.safeParse(food);
      if (!result.success) {
        throw new Error(
          `${food.name} failed validation: ${JSON.stringify(
            result.error.issues,
            null,
            2,
          )}`,
        );
      }
    }
  });

  it("has no duplicate name + brand pairs", () => {
    const keys = SEED_FOODS.map((f) => `${f.name}::${f.brand ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every food has a serving weight, so it can be logged by grams", () => {
    for (const food of SEED_FOODS) {
      expect(food.servingWeightGrams, food.name).toBeGreaterThan(0);
    }
  });

  it("calories agree with the macros they are made of", () => {
    // Atwater: 4 kcal/g protein, 9 kcal/g fat, 4 kcal/g carb. Labels round and
    // fiber is only partly available, so this is a loose sanity check — it is
    // here to catch a typo'd decimal point, not to police label rounding.
    for (const food of SEED_FOODS) {
      const derived =
        food.proteinPerServing * 4 +
        food.fatPerServing * 9 +
        food.carbsPerServing * 4;

      // Foods under 25 kcal are dominated by rounding; skip them.
      if (food.caloriesPerServing < 25) continue;

      const ratio = derived / food.caloriesPerServing;
      expect(
        ratio,
        `${food.name}: label says ${food.caloriesPerServing} kcal but its ` +
          `macros imply ${Math.round(derived)} kcal`,
      ).toBeGreaterThan(0.75);
      expect(ratio, food.name).toBeLessThan(1.3);
    }
  });

  it("fiber never exceeds carbohydrates", () => {
    for (const food of SEED_FOODS) {
      expect(food.fiberPerServing, food.name).toBeLessThanOrEqual(
        food.carbsPerServing,
      );
    }
  });

  it("label-verified foods actually claim a label as their source", () => {
    for (const food of SEED_FOODS) {
      if (food.verificationStatus === "label_verified") {
        expect(food.dataSource, food.name).toBe("nutrition_label");
      }
      if (food.verificationStatus === "usda_verified") {
        expect(["usda_generic", "usda_branded"], food.name).toContain(
          food.dataSource,
        );
      }
    }
  });

  it("computes a real breakfast correctly end to end", () => {
    const egg = SEED_FOODS.find((f) => f.name === "Egg, large")!;
    const oatmeal = SEED_FOODS.find((f) =>
      f.name.startsWith("Instant oatmeal"),
    )!;
    const banana = SEED_FOODS.find((f) => f.name === "Banana")!;

    const eggs = computeLogMacros(egg, 2);
    expect(eggs.calories).toBe(144);
    expect(eggs.protein).toBeCloseTo(12.6, 10);

    const total =
      eggs.calories +
      computeLogMacros(oatmeal, 1).calories +
      computeLogMacros(banana, 1).calories;

    expect(total).toBe(409);
  });
});
