import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { aiFoodSchema, coachSchema, type AiFood, type CoachReply } from "./schemas";

/**
 * Claude calls, kept as plain functions so they can be exercised without an
 * HTTP layer. The route handlers are thin wrappers that add auth.
 *
 * Claude is a search and data-entry assistant here, never the authoritative
 * nutrition source. The source priority the app enforces is:
 *   photographed label  >  branded USDA  >  generic USDA  >  AI estimate
 */

const MODEL = "claude-opus-5";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. See SETUP.md step 5.");
  }
  return new Anthropic({ apiKey });
}

/**
 * The rule that keeps this honest. A confident wrong serving size is worse
 * than an admitted uncertain one — that is exactly how the Notion tracker
 * accumulated numbers nobody could trace.
 */
const SERVING_RULE = `
Rules you must follow:
- Report nutrition for exactly ONE serving. Never report a total for several servings.
- Never silently invent a serving size. If the description is ambiguous about
  quantity ("some chicken", "a bowl of oats"), pick the most standard serving,
  set needsClarification to true, and put the question you would ask in
  clarifyingQuestion.
- Be honest in confidence. "high" is only for a nutrition label you can read or
  an exact branded product you are certain of. Estimates from a description are
  "low".
- Prefer well-known reference values (USDA and similar) over invention.
- Grams: give servingWeightGrams when the serving has a standard weight, and
  null when it genuinely does not.
`.trim();

/** Natural-language food lookup: "medium grilled pork chop, about 5 oz cooked". */
export async function lookupFood(query: string): Promise<AiFood> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    // Nutrition reasoning benefits from thinking; adaptive lets Claude decide
    // how much a given query actually needs.
    thinking: { type: "adaptive" },
    system: `You help log food in a muscle-gain tracker. Given a description, return the nutrition for one serving.\n\n${SERVING_RULE}`,
    messages: [{ role: "user", content: query }],
    output_config: { format: zodOutputFormat(aiFoodSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a usable food record.");
  }
  return response.parsed_output;
}

/** Nutrition-label photo → structured macros. */
export async function scanLabel(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
): Promise<AiFood> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: `You read nutrition labels for a food tracker. Extract the values exactly as printed.\n\n${SERVING_RULE}\n\nAdditional rules for labels:\n- Use the serving size printed on the label, not the whole package, unless the label says the package is one serving.\n- If the label shows both "per serving" and "per container", use per serving.\n- If part of the label is unreadable, say so in notes and lower the confidence.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "Read this nutrition label and return the values for one serving.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(aiFoodSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Could not read that label.");
  }
  return response.parsed_output;
}

export type CoachInput = {
  goal: string;
  targets: { calories: number; protein: number; fat: number };
  weeks: {
    weekStart: string;
    loggedDays: number;
    avgCalories: number | null;
    avgProtein: number | null;
    calorieTargetDays: number;
    avgWeight: number | null;
    weightChange: number | null;
  }[];
};

/** Weekly coaching note, grounded strictly in the numbers passed in. */
export async function coachSummary(input: CoachInput): Promise<CoachReply> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    system: `You are a strength-training nutrition coach reviewing a weekly log.

Context: the goal is ${input.goal}. Daily targets are ${input.targets.calories} calories, ${input.targets.protein} g protein, ${input.targets.fat} g fat. A healthy rate is 0.25 to 0.5 lb per week.

Rules:
- Use ONLY the numbers provided. Never invent a figure, and never infer data for days that were not logged.
- Weekly averages matter; a single day does not. Do not treat one low day as failure.
- Gaining faster than 0.5 lb/week is as much a miss as gaining nothing — say so.
- If there is too little data to judge, say that plainly instead of guessing.
- Be direct and specific. No pep talk, no exclamation marks.`,
    messages: [
      {
        role: "user",
        content: `Here is the recent history as JSON:\n\n${JSON.stringify(input.weeks, null, 2)}`,
      },
    ],
    output_config: { format: zodOutputFormat(coachSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Claude did not return a usable summary.");
  }
  return response.parsed_output;
}
