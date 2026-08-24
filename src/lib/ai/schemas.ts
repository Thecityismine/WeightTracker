import { z } from "zod";

/**
 * Shapes Claude must return.
 *
 * These are the contract for structured outputs, so the model cannot answer
 * with prose where a number belongs. Fields are nullable rather than optional:
 * the model must decide and say so, not quietly omit.
 */

export const aiFoodSchema = z.object({
  name: z.string().describe("Food name, title case, no shouting"),
  brand: z.string().nullable().describe("Brand, or null for a generic food"),

  servingDescription: z
    .string()
    .describe("One serving in plain words, e.g. '1 large egg' or '4 oz cooked'"),
  servingWeightGrams: z
    .number()
    .nullable()
    .describe("Grams in one serving, or null if genuinely unknown"),

  caloriesPerServing: z.number().describe("Calories in ONE serving"),
  proteinPerServing: z.number().describe("Protein grams in ONE serving"),
  fatPerServing: z.number().describe("Fat grams in ONE serving"),
  carbsPerServing: z.number().describe("Carbohydrate grams in ONE serving"),
  fiberPerServing: z.number().describe("Fiber grams in ONE serving"),

  sugarPerServing: z
    .number()
    .nullable()
    .describe("Total sugar GRAMS in one serving, or null if not known"),
  saturatedFatPerServing: z
    .number()
    .nullable()
    .describe("Saturated fat GRAMS in one serving, or null if not known"),
  cholesterolMgPerServing: z
    .number()
    .nullable()
    .describe("Cholesterol MILLIGRAMS in one serving, or null if not known"),
  sodiumMgPerServing: z
    .number()
    .nullable()
    .describe("Sodium MILLIGRAMS in one serving, or null if not known"),

  confidence: z
    .enum(["high", "medium", "low"])
    .describe(
      "high = read from a label or an exact known product; medium = a close standard reference; low = an estimate from description alone",
    ),

  needsClarification: z
    .boolean()
    .describe(
      "True when the serving size is ambiguous and you had to assume one",
    ),
  clarifyingQuestion: z
    .string()
    .nullable()
    .describe("The question to ask, when needsClarification is true"),

  notes: z
    .string()
    .describe("One short sentence on where these numbers came from"),
});

export type AiFood = z.infer<typeof aiFoodSchema>;

export const coachSchema = z.object({
  summary: z
    .string()
    .describe("Two to four sentences interpreting the week in plain language"),
  suggestion: z
    .string()
    .describe("One concrete, actionable suggestion for the coming week"),
});

export type CoachReply = z.infer<typeof coachSchema>;

/**
 * A smart-scale screenshot.
 *
 * Every field is nullable because scales differ in what they display and a
 * screenshot may be cropped. Null means "not visible in this image" — never
 * an invented number, which for a health metric would be worse than a gap.
 */
export const scaleReadingSchema = z.object({
  bodyFatPercent: z.number().nullable().describe("Body fat percentage"),
  bmi: z.number().nullable().describe("BMI"),
  muscleMassLb: z
    .number()
    .nullable()
    .describe("Muscle mass in POUNDS; convert if the screenshot shows kg"),
  visceralFat: z.number().nullable().describe("Visceral fat index, unitless"),
  bodyWaterPercent: z.number().nullable().describe("Body water percentage"),
  subcutaneousFatPercent: z
    .number()
    .nullable()
    .describe("Subcutaneous fat percentage"),
  skeletalMusclePercent: z
    .number()
    .nullable()
    .describe("Skeletal muscle percentage"),
  boneMassLb: z
    .number()
    .nullable()
    .describe("Bone mass in POUNDS; convert if shown in kg"),
  fatFreeMassLb: z
    .number()
    .nullable()
    .describe("Fat-free body weight in POUNDS; convert if shown in kg"),
  bmrKcal: z.number().nullable().describe("BMR in kcal"),
  proteinPercent: z.number().nullable().describe("Protein percentage"),
  metabolicAge: z.number().nullable().describe("Metabolic age in years"),

  ratings: z
    .object({
      bodyFatPercent: z.string().nullable(),
      bmi: z.string().nullable(),
      muscleMassLb: z.string().nullable(),
      visceralFat: z.string().nullable(),
      bodyWaterPercent: z.string().nullable(),
      subcutaneousFatPercent: z.string().nullable(),
      skeletalMusclePercent: z.string().nullable(),
      boneMassLb: z.string().nullable(),
      fatFreeMassLb: z.string().nullable(),
      bmrKcal: z.string().nullable(),
      proteinPercent: z.string().nullable(),
      metabolicAge: z.string().nullable(),
    })
    .describe(
      "The device's own word under each metric, copied verbatim: Excellent, Standard, Acceptable, High, and so on. Null where no label is shown.",
    ),

  unreadable: z
    .array(z.string())
    .describe("Names of any metrics visible but too blurred or cropped to read"),
  notes: z.string().describe("One short sentence on what was read"),
});

export type ScaleReading = z.infer<typeof scaleReadingSchema>;
