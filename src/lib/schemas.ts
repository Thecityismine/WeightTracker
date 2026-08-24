import { z } from "zod";
import { MEAL_CATEGORIES } from "./constants";

/**
 * Validation for every write path.
 *
 * The Notion tracker failed because bad data could get in. Nothing reaches
 * Firestore without passing through here.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** Macros are never negative and never absurd. */
const macroValue = z
  .number()
  .finite()
  .min(0, "Cannot be negative")
  .max(10000, "Implausibly large — check the units");

export const verificationStatusSchema = z.enum([
  "label_verified",
  "usda_verified",
  "user_entered",
  "ai_estimated",
]);

export const dataSourceSchema = z.enum([
  "nutrition_label",
  "usda_branded",
  "usda_generic",
  "ai_estimate",
  "manual",
]);

export const foodCategorySchema = z.enum([
  "protein",
  "carb",
  "fat",
  "dairy",
  "fruit",
  "vegetable",
  "supplement",
  "snack",
  "beverage",
  "condiment",
  "mixed",
]);

export const mealCategorySchema = z.enum(MEAL_CATEGORIES);

export const foodInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    brand: z.string().trim().max(80).nullable().default(null),
    category: foodCategorySchema,

    // A food without a serving is unusable — every total depends on it.
    servingDescription: z
      .string()
      .trim()
      .min(1, "Describe one serving, e.g. '1 large egg'")
      .max(80),
    servingAmount: z.number().finite().positive("Serving amount must be > 0"),
    servingUnit: z.string().trim().min(1, "Serving unit is required").max(30),
    servingWeightGrams: z
      .number()
      .finite()
      .positive()
      .max(5000)
      .nullable()
      .default(null),

    caloriesPerServing: macroValue,
    proteinPerServing: macroValue,
    fatPerServing: macroValue,
    carbsPerServing: macroValue.default(0),
    fiberPerServing: macroValue.default(0),

    dataSource: dataSourceSchema,
    externalFoodId: z.string().trim().max(60).nullable().default(null),
    verificationStatus: verificationStatusSchema,
    confidenceScore: z.number().min(0).max(1).nullable().default(null),
    labelImageUrl: z.string().url().nullable().default(null),

    isFavorite: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine(
    (f) => f.fiberPerServing <= f.carbsPerServing + 0.001,
    {
      message: "Fiber cannot exceed total carbohydrates",
      path: ["fiberPerServing"],
    },
  )
  .refine(
    (f) => f.verificationStatus !== "ai_estimated" || f.confidenceScore != null,
    {
      message: "AI-estimated foods must carry a confidence score",
      path: ["confidenceScore"],
    },
  );

export type FoodInput = z.infer<typeof foodInputSchema>;

export const foodLogInputSchema = z.object({
  foodId: z.string().min(1),
  logDate: isoDate,
  mealCategory: mealCategorySchema,
  // Zero servings is not a log entry, it is a deletion.
  quantity: z
    .number()
    .finite()
    .positive("Quantity must be greater than zero")
    .max(200, "That is an implausible number of servings"),
});

export type FoodLogInput = z.infer<typeof foodLogInputSchema>;

export const weightLogInputSchema = z.object({
  date: isoDate,
  // Wide enough for lb or kg, narrow enough to catch a typo'd decimal.
  weight: z.number().finite().min(30).max(700),
  waistMeasurement: z.number().finite().min(10).max(100).nullable().default(null),
  note: z.string().trim().max(500).nullable().default(null),
});

export type WeightLogInput = z.infer<typeof weightLogInputSchema>;

export const macroTargetsSchema = z.object({
  calories: z.number().int().min(800).max(10000),
  protein: z.number().min(0).max(500),
  fat: z.number().min(0).max(400),
});

export const profileInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  startingWeight: z.number().finite().min(30).max(700),
  goalWeight: z.number().finite().min(30).max(700),
  startingDate: isoDate,
  targetDate: isoDate.nullable().default(null),
  heightInches: z.number().finite().min(20).max(100).nullable().default(null),
  birthDate: isoDate.nullable().default(null),
  sex: z.enum(["male", "female", "other"]).nullable().default(null),
  activityLevel: z
    .enum(["sedentary", "light", "moderate", "active", "very_active"])
    .default("moderate"),
  workoutDaysPerWeek: z.number().int().min(0).max(7).default(3),
  weightUnit: z.enum(["lb", "kg"]).default("lb"),
  dailyCalorieTarget: z.number().int().min(800).max(10000),
  dailyProteinTarget: z.number().min(0).max(500),
  dailyFatTarget: z.number().min(0).max(400),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const mealTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  defaultMealCategory: mealCategorySchema,
  items: z
    .array(
      z.object({
        foodId: z.string().min(1),
        quantity: z.number().finite().positive().max(200),
      }),
    )
    .min(1, "A template needs at least one food"),
});

export type MealTemplateInput = z.infer<typeof mealTemplateInputSchema>;
