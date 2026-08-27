import { describe, expect, it } from "vitest";
import { foodInputSchema, progressPhotoInputSchema } from "./schemas";

describe("progress photos", () => {
  it("accepts a private progress image with optional weight", () => {
    expect(
      progressPhotoInputSchema.safeParse({
        photoDate: "2026-08-26",
        imageUrl: "https://firebasestorage.googleapis.com/photo.jpg",
        storagePath: "progress/user/photo.jpg",
        weight: 144.3,
      }).success,
    ).toBe(true);
  });

  it("rejects paths outside the progress-photo area", () => {
    expect(
      progressPhotoInputSchema.safeParse({
        photoDate: "2026-08-26",
        imageUrl: "https://example.com/photo.jpg",
        storagePath: "labels/user/photo.jpg",
        weight: null,
      }).success,
    ).toBe(false);
  });
});

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

describe("potassium", () => {
  it("defaults to null, like the other label extras", () => {
    expect(foodInputSchema.parse(BASE).potassiumMgPerServing).toBeNull();
  });

  it("accepts a milligram figure well past the gram-scale ceiling", () => {
    // A baked potato is over 900 mg; a grams-oriented max would reject it.
    const r = foodInputSchema.safeParse({ ...BASE, potassiumMgPerServing: 926 });
    expect(r.success).toBe(true);
  });

  it("rejects a negative value", () => {
    const r = foodInputSchema.safeParse({ ...BASE, potassiumMgPerServing: -5 });
    expect(r.success).toBe(false);
  });
});
