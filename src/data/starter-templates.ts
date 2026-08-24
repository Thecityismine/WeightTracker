import type { MealCategory } from "@/lib/constants";

/**
 * Starter meal templates, defined by food NAME so they can be resolved
 * against whatever is in the database at load time.
 *
 * Quantities are in servings, not household units — one serving of rolled
 * oats is already ½ cup, so "½ cup of oats" is quantity 1, not 0.5. Getting
 * this backwards is exactly the class of error the app exists to prevent.
 */
export type StarterTemplate = {
  name: string;
  meal: MealCategory;
  /** Portions the listed quantities make. 1 means already per-serving. */
  servingsPrepared?: number;
  items: { foodName: string; quantity: number }[];
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "Regular breakfast",
    meal: "breakfast",
    items: [
      { foodName: "Egg, large", quantity: 2 },
      { foodName: "Instant oatmeal, maple brown sugar", quantity: 1 },
      { foodName: "Banana", quantity: 1 },
    ],
  },
  {
    name: "Weekend breakfast",
    meal: "breakfast",
    items: [
      { foodName: "Egg, large", quantity: 3 },
      { foodName: "Whole wheat bread", quantity: 2 },
      { foodName: "Peanut butter", quantity: 1 },
      { foodName: "Banana", quantity: 1 },
    ],
  },
  {
    name: "Workday lunch",
    meal: "lunch",
    items: [
      { foodName: "Chicken breast, boneless skinless, cooked", quantity: 1 },
      { foodName: "White rice, cooked", quantity: 1 },
      { foodName: "Mixed vegetables, frozen, cooked", quantity: 1 },
      { foodName: "Olive oil", quantity: 1 },
    ],
  },
  {
    name: "Regular shake",
    meal: "shake",
    items: [
      { foodName: "ISO 100 Whey Protein Isolate", quantity: 1 },
      // Half a container, as the framework doc specifies.
      { foodName: "Ratio Protein Yogurt, vanilla", quantity: 0.5 },
      // One serving of rolled oats IS ½ cup dry.
      { foodName: "Rolled oats, dry", quantity: 1 },
      { foodName: "Banana", quantity: 1 },
      { foodName: "Whole milk", quantity: 1 },
      { foodName: "Honey", quantity: 1 },
    ],
  },
  {
    // A batch recipe: the quantities below are for the WHOLE pan, and one
    // tablespoon of oil cooking four bowls contributes a quarter tablespoon to
    // each. Seasonings are separate ingredients rather than baked into the
    // chicken, so the salt can be adjusted without touching the protein.
    name: "Chicken and quinoa bowl (batch of 4)",
    meal: "lunch",
    servingsPrepared: 4,
    items: [
      { foodName: "Quinoa, cooked", quantity: 4 },
      { foodName: "Chicken breast, cooked, diced", quantity: 4 },
      { foodName: "Onion and green pepper, cooked", quantity: 4 },
      { foodName: "Olive oil", quantity: 1 },
      { foodName: "Garlic powder", quantity: 1 },
      { foodName: "Black pepper, ground", quantity: 0.5 },
      { foodName: "Paprika", quantity: 1 },
      { foodName: "Table salt", quantity: 0.5 },
    ],
  },
  {
    name: "Apple and trail mix",
    meal: "snack",
    items: [
      { foodName: "Apple", quantity: 1 },
      { foodName: "Trail mix", quantity: 1 },
    ],
  },
];
