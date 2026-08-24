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
