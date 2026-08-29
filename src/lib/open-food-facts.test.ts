import { describe, expect, it } from "vitest";
import { mapOpenFoodFactsProduct } from "./open-food-facts";

describe("Open Food Facts barcode mapping", () => {
  it("uses per-serving macros and converts milligrams", () => {
    const food = mapOpenFoodFactsProduct(
      {
        status: 1,
        product: {
          product_name: "Test Protein Bar",
          brands: "Example",
          serving_size: "1 bar (60 g)",
          serving_quantity: 60,
          nutriments: {
            "energy-kcal_serving": 240,
            proteins_serving: 20,
            fat_serving: 8,
            carbohydrates_serving: 24,
            fiber_serving: 5,
            sodium_serving: 0.32,
          },
        },
      },
      "012345678905",
    );

    expect(food).toMatchObject({
      name: "Test Protein Bar",
      caloriesPerServing: 240,
      proteinPerServing: 20,
      sodiumMgPerServing: 320,
      dataSource: "open_food_facts",
      verificationStatus: "barcode_imported",
      externalFoodId: "012345678905",
    });
  });

  it("scales per-100g values when serving values are absent", () => {
    const food = mapOpenFoodFactsProduct(
      {
        status: 1,
        product: {
          product_name: "Cereal",
          serving_quantity: "40",
          nutriments: {
            "energy-kcal_100g": 400,
            proteins_100g: 10,
            carbohydrates_100g: 70,
          },
        },
      },
      "12345678",
    );
    expect(food?.caloriesPerServing).toBe(160);
    expect(food?.proteinPerServing).toBe(4);
  });

  it("rejects missing products and records without calories", () => {
    expect(mapOpenFoodFactsProduct({ status: 0 }, "12345678")).toBeNull();
    expect(
      mapOpenFoodFactsProduct(
        { status: 1, product: { product_name: "No nutrition" } },
        "12345678",
      ),
    ).toBeNull();
  });
});
