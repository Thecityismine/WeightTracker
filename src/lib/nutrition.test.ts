import { describe, expect, it } from "vitest";
import {
  carbTarget,
  computeExtendedMacros,
  computeLogMacros,
  dayStatus,
  formatCalories,
  formatMacro,
  gramsToServings,
  isTargetReached,
  portionQuantity,
  progressPercent,
  progressRatio,
  projectedWeeklyGain,
  remaining,
  roundTo,
  sumMacros,
  trailingAverage,
} from "./nutrition";
import type { ServingNutrition } from "@/types";

/** Eggland's Best, 1 large egg, straight off the carton. */
const EGG: ServingNutrition = {
  caloriesPerServing: 72,
  proteinPerServing: 6.3,
  fatPerServing: 4.8,
  carbsPerServing: 0,
  fiberPerServing: 0,
};

/** Rolled oats, 1/2 cup dry, 40 g. */
const OATS: ServingNutrition = {
  caloriesPerServing: 150,
  proteinPerServing: 5,
  fatPerServing: 3,
  carbsPerServing: 27,
  fiberPerServing: 4,
};

describe("computeLogMacros", () => {
  it("multiplies one base serving by the quantity", () => {
    // The case the whole app exists to get right: 72 x 2 = 144.
    const total = computeLogMacros(EGG, 2);
    expect(total.calories).toBe(144);
    expect(total.protein).toBeCloseTo(12.6, 10);
    expect(total.fat).toBeCloseTo(9.6, 10);
  });

  it("handles a single serving as an identity", () => {
    expect(computeLogMacros(OATS, 1)).toEqual({
      calories: 150,
      protein: 5,
      fat: 3,
      carbs: 27,
      fiber: 4,
    });
  });

  it("handles fractional quantities", () => {
    const half = computeLogMacros(OATS, 0.5);
    expect(half.calories).toBe(75);
    expect(half.carbs).toBe(13.5);
    expect(half.fiber).toBe(2);
  });

  it("returns zeros for a quantity of zero", () => {
    expect(computeLogMacros(EGG, 0)).toEqual({
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
    });
  });

  it("carries carbs and fiber through even though the dashboard hides them", () => {
    const total = computeLogMacros(OATS, 3);
    expect(total.carbs).toBe(81);
    expect(total.fiber).toBe(12);
  });

  it("throws rather than producing NaN", () => {
    expect(() => computeLogMacros(EGG, Number.NaN)).toThrow(TypeError);
    expect(() => computeLogMacros(EGG, Number.POSITIVE_INFINITY)).toThrow(
      TypeError,
    );
    // A silently wrong number is worse than a loud failure.
    expect(() =>
      computeLogMacros({ ...EGG, caloriesPerServing: Number.NaN }, 1),
    ).toThrow(TypeError);
  });

  it("rejects negative quantities", () => {
    expect(() => computeLogMacros(EGG, -1)).toThrow(RangeError);
  });
});

describe("gramsToServings", () => {
  it("divides grams eaten by grams per serving", () => {
    // 60 g of oats when a serving is 40 g = 1.5 servings.
    expect(gramsToServings(60, 40)).toBe(1.5);
  });

  it("composes with computeLogMacros to scale by weight", () => {
    const servings = gramsToServings(60, 40);
    const total = computeLogMacros(OATS, servings);
    expect(total.calories).toBe(225);
    expect(total.protein).toBe(7.5);
  });

  it("refuses to guess when a food has no serving weight", () => {
    expect(() => gramsToServings(50, null)).toThrow(RangeError);
    expect(() => gramsToServings(50, 0)).toThrow(RangeError);
  });

  it("rejects negative grams", () => {
    expect(() => gramsToServings(-5, 40)).toThrow(RangeError);
  });
});

describe("sumMacros", () => {
  it("adds a full breakfast", () => {
    // Eggs 2, oatmeal packet, banana — the example from the framework doc.
    const eggs = computeLogMacros(EGG, 2);
    const oatmeal = {
      calories: 230,
      protein: 12,
      fat: 3.5,
      carbs: 40,
      fiber: 4,
    };
    const banana = {
      calories: 105,
      protein: 1.3,
      fat: 0.4,
      carbs: 27,
      fiber: 3.1,
    };

    const total = sumMacros([eggs, oatmeal, banana]);
    expect(total.calories).toBe(479);
    expect(roundTo(total.protein, 1)).toBe(25.9);
  });

  it("returns zeros for an empty day", () => {
    expect(sumMacros([])).toEqual({
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: 0,
    });
  });

  it("tolerates partial macro sets", () => {
    expect(sumMacros([{ calories: 100 }, { protein: 5 }]).calories).toBe(100);
  });
});

describe("remaining", () => {
  const targets = { calories: 2800, protein: 130, fat: 80 };

  it("reports what is left", () => {
    const left = remaining({ calories: 2310, protein: 118, fat: 67 }, targets);
    expect(left.calories).toBe(490);
    expect(left.protein).toBe(12);
    expect(left.fat).toBe(13);
  });

  it("goes negative past the target instead of clamping", () => {
    // Past target is a surplus, and the caller decides how to say so.
    expect(remaining({ calories: 3000, protein: 140, fat: 90 }, targets)
      .calories).toBe(-200);
  });
});

describe("progress", () => {
  it("computes a ratio against the target", () => {
    expect(progressRatio(1400, 2800)).toBe(0.5);
  });

  it("caps the bar at 100% but not the ratio", () => {
    expect(progressPercent(5600, 2800)).toBe(100);
    expect(progressRatio(5600, 2800)).toBe(2);
  });

  it("does not divide by zero", () => {
    expect(progressRatio(500, 0)).toBe(0);
    expect(progressPercent(500, 0)).toBe(0);
  });
});

describe("dayStatus", () => {
  const target = 2800;

  it("is gray with no entries", () => {
    expect(dayStatus(0, target)).toBe("none");
    expect(dayStatus(0, target, false)).toBe("none");
  });

  it("is below under 90%", () => {
    expect(dayStatus(2000, target)).toBe("below"); // 71%
    expect(dayStatus(2519, target)).toBe("below"); // 89.9%
  });

  it("is near between 90% and 100%", () => {
    expect(dayStatus(2520, target)).toBe("near"); // exactly 90%
    expect(dayStatus(2799, target)).toBe("near");
  });

  it("is on target from 100% to 115%", () => {
    expect(dayStatus(2800, target)).toBe("ontarget");
    expect(dayStatus(3220, target)).toBe("ontarget"); // exactly 115%
  });

  it("is surplus above 115%", () => {
    expect(dayStatus(3221, target)).toBe("surplus");
  });

  it("treats a logged day of zero calories as below, not empty", () => {
    expect(dayStatus(0, target, true)).toBe("below");
  });
});

describe("isTargetReached", () => {
  it("flips exactly at the target", () => {
    expect(isTargetReached(2799, 2800)).toBe(false);
    expect(isTargetReached(2800, 2800)).toBe(true);
    expect(isTargetReached(3200, 2800)).toBe(true);
  });
});

describe("projectedWeeklyGain", () => {
  it("converts a daily surplus into pounds per week", () => {
    // 250 kcal/day x 7 = 1750 kcal = 0.5 lb, the top of the target range.
    expect(projectedWeeklyGain(250)).toBeCloseTo(0.5, 5);
    expect(projectedWeeklyGain(125)).toBeCloseTo(0.25, 5);
  });
});

describe("display formatting", () => {
  it("rounds calories to whole numbers with separators", () => {
    expect(formatCalories(2810.4)).toBe("2,810");
    expect(formatCalories(2809.6)).toBe("2,810");
  });

  it("rounds macros to one decimal and drops trailing zeros", () => {
    expect(formatMacro(12.64)).toBe("12.6");
    expect(formatMacro(13.0)).toBe("13");
    expect(formatMacro(0.04)).toBe("0");
  });

  it("keeps full precision until display, so sums do not drift", () => {
    // Thirty logs of 0.1 g each: rounding every step would lose the total.
    const logs = Array.from({ length: 30 }, () => ({ protein: 0.1 }));
    const total = sumMacros(logs);
    expect(roundTo(total.protein, 1)).toBe(3);
  });
});

describe("trailingAverage", () => {
  it("averages the last seven values", () => {
    const weights = [144.0, 144.4, 143.8, 144.2, 144.6, 144.1, 144.5];
    expect(trailingAverage(weights)).toBeCloseTo(144.229, 3);
  });

  it("ignores everything before the window", () => {
    // The 100 must not drag the average — it is outside the seven-day window.
    const values = [100, 1, 1, 1, 1, 1, 1, 1];
    expect(trailingAverage(values, 7)).toBe(1);
  });

  it("averages what exists when there are fewer than seven days", () => {
    expect(trailingAverage([144, 145])).toBe(144.5);
  });

  it("returns null with no data rather than NaN", () => {
    expect(trailingAverage([])).toBeNull();
  });
});

describe("computeExtendedMacros", () => {
  const LABEL = {
    sugarPerServing: 12,
    saturatedFatPerServing: 1.5,
    cholesterolMgPerServing: 30,
    sodiumMgPerServing: 210,
    potassiumMgPerServing: 180,
  };

  it("scales by quantity like the core macros", () => {
    const m = computeExtendedMacros(LABEL, 2);
    expect(m.sugar).toBe(24);
    expect(m.saturatedFat).toBe(3);
    expect(m.cholesterolMg).toBe(60);
    expect(m.sodiumMg).toBe(420);
    expect(m.potassiumMg).toBe(360);
  });

  it("keeps unknown values unknown instead of turning them into zero", () => {
    // A food with no sodium on its label must not report 0 mg of sodium —
    // that would understate a day's total while looking authoritative.
    const partial = { ...LABEL, sodiumMgPerServing: null };
    const m = computeExtendedMacros(partial, 3);
    expect(m.sodiumMg).toBeNull();
    expect(m.sugar).toBe(36);
  });

  it("returns all nulls for a food with none of them recorded", () => {
    const m = computeExtendedMacros(
      {
        sugarPerServing: null,
        saturatedFatPerServing: null,
        cholesterolMgPerServing: null,
        sodiumMgPerServing: null,
        potassiumMgPerServing: null,
      },
      2,
    );
    expect(m).toEqual({
      sugar: null,
      saturatedFat: null,
      cholesterolMg: null,
      sodiumMg: null,
      potassiumMg: null,
    });
  });
});

describe("carbTarget", () => {
  it("is whatever calories protein and fat leave behind", () => {
    // 2800 - (130 x 4) - (80 x 9) = 1560 kcal, and 1560 / 4 = 390 g.
    expect(carbTarget({ calories: 2800, protein: 130, fat: 80 })).toBe(390);
  });

  it("moves with the calorie target", () => {
    expect(carbTarget({ calories: 2950, protein: 130, fat: 80 })).toBeCloseTo(
      427.5,
      5,
    );
  });

  it("shrinks when protein or fat rise", () => {
    const base = carbTarget({ calories: 2800, protein: 130, fat: 80 });
    const higherProtein = carbTarget({ calories: 2800, protein: 180, fat: 80 });
    expect(higherProtein).toBeLessThan(base);
  });

  it("floors at zero rather than going negative", () => {
    // Protein and fat alone already exceed the calorie budget.
    expect(carbTarget({ calories: 1000, protein: 200, fat: 100 })).toBe(0);
  });
});

describe("portionQuantity", () => {
  it("splits a batch ingredient across the servings it made", () => {
    // One tablespoon of oil in a pan cooking four bowls.
    expect(portionQuantity(1, 1, 4)).toBe(0.25);
  });

  it("scales when more than one portion is eaten", () => {
    expect(portionQuantity(1, 2, 4)).toBe(0.5);
  });

  it("is the identity for a single-serving recipe", () => {
    // servingsPrepared 1 means the quantities are already per-serving, which
    // is how every template behaved before recipes existed.
    expect(portionQuantity(3, 1, 1)).toBe(3);
  });

  it("handles the framework doc's oil example", () => {
    // 1 tbsp olive oil = 119 kcal, 13.5 g fat. A quarter of that is what the
    // doc says to record: about 30 kcal and 3.4 g fat.
    const q = portionQuantity(1, 1, 4);
    const oil = {
      caloriesPerServing: 119,
      proteinPerServing: 0,
      fatPerServing: 13.5,
      carbsPerServing: 0,
      fiberPerServing: 0,
    };
    const macros = computeLogMacros(oil, q);
    expect(Math.round(macros.calories)).toBe(30);
    expect(roundTo(macros.fat, 1)).toBe(3.4);
  });

  it("refuses to divide by zero servings", () => {
    expect(() => portionQuantity(1, 1, 0)).toThrow(RangeError);
    expect(() => portionQuantity(1, 1, -2)).toThrow(RangeError);
  });

  it("throws rather than producing NaN", () => {
    expect(() => portionQuantity(Number.NaN, 1, 4)).toThrow(TypeError);
  });
});
