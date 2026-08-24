import { describe, expect, it } from "vitest";
import { foodInputSchema } from "./schemas";

const BASE = {
  name: "Test food",
  brand: null,
  category: "mixed" as const,
  servingDescription: "1 serving",
  servingAmount: 1,
  servingUnit: "serving",
  servingWeightGrams: 100,
  caloriesPerServing: 200,
  proteinPerServing: 10,
  fatPerServing: 8,
  carbsPerServing: 20,
  fiberPerServing: 3,
  dataSource: "manual" as const,
  verificationStatus: "user_entered" as const,
};

describe("secondary label values", () => {
  it("default to null when omitted — unknown, not zero", () => {
    const parsed = foodInputSchema.parse(BASE);
    expect(parsed.sugarPerServing).toBeNull();
    expect(parsed.saturatedFatPerServing).toBeNull();
    expect(parsed.cholesterolMgPerServing).toBeNull();
    expect(parsed.sodiumMgPerServing).toBeNull();
  });

  it("accepts real label values", () => {
    const parsed = foodInputSchema.parse({
      ...BASE,
      sugarPerServing: 12,
      saturatedFatPerServing: 2.5,
      cholesterolMgPerServing: 30,
      sodiumMgPerServing: 450,
    });
    expect(parsed.sugarPerServing).toBe(12);
    expect(parsed.sodiumMgPerServing).toBe(450);
  });

  it("rejects sugar exceeding total carbohydrate", () => {
    const result = foodInputSchema.safeParse({
      ...BASE,
      carbsPerServing: 20,
      sugarPerServing: 25,
    });
    expect(result.success).toBe(false);
  });

  it("rejects saturated fat exceeding total fat", () => {
    const result = foodInputSchema.safeParse({
      ...BASE,
      fatPerServing: 8,
      saturatedFatPerServing: 9,
    });
    expect(result.success).toBe(false);
  });

  it("allows sugar exactly equal to carbs", () => {
    // Honey, pure syrups: every carb is sugar.
    const result = foodInputSchema.safeParse({
      ...BASE,
      carbsPerServing: 17,
      fiberPerServing: 0,
      sugarPerServing: 17,
    });
    expect(result.success).toBe(true);
  });

  it("allows a sodium figure well above the gram-scale ceiling", () => {
    // 2,300 mg would fail a grams-oriented max; milligrams need their own.
    const result = foodInputSchema.safeParse({ ...BASE, sodiumMgPerServing: 2300 });
    expect(result.success).toBe(true);
  });
});
