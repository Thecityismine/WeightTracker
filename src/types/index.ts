import type { MealCategory } from "@/lib/constants";

export type { MealCategory };

/** Where a food's numbers came from. Drives the badge and the source dot. */
export type VerificationStatus =
  | "label_verified"
  | "usda_verified"
  | "user_entered"
  | "ai_estimated";

export type DataSource =
  | "nutrition_label"
  | "usda_branded"
  | "usda_generic"
  | "ai_estimate"
  | "manual";

export type FoodCategory =
  | "protein"
  | "carb"
  | "fat"
  | "dairy"
  | "fruit"
  | "vegetable"
  | "supplement"
  | "snack"
  | "beverage"
  | "condiment"
  | "mixed";

/**
 * The five macro values that flow through the whole app.
 *
 * Carbs and fiber are stored from day one even though the dashboard does not
 * emphasize them — that data is impossible to reconstruct later.
 */
export type MacroSet = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
};

/** Nutrition for exactly ONE base serving. The single source of truth. */
export type ServingNutrition = {
  caloriesPerServing: number;
  proteinPerServing: number;
  fatPerServing: number;
  carbsPerServing: number;
  fiberPerServing: number;
};

/**
 * Secondary label values.
 *
 * Nullable on purpose, unlike the five core macros. These are often absent —
 * no seed food has them, and USDA generic records frequently omit them. Null
 * means "not known", which is a different claim from zero, and defaulting an
 * unknown sodium figure to 0 would quietly understate a day's total.
 *
 * UNITS: sugar and saturated fat in GRAMS; cholesterol, sodium and potassium
 * in MILLIGRAMS, matching how a nutrition label prints them.
 */
export type ExtendedNutrition = {
  sugarPerServing: number | null;
  saturatedFatPerServing: number | null;
  cholesterolMgPerServing: number | null;
  sodiumMgPerServing: number | null;
  potassiumMgPerServing: number | null;
};

export type Food = ServingNutrition &
  ExtendedNutrition & {
  id: string;
  userId: string;
  name: string;
  brand: string | null;
  category: FoodCategory;

  /** Human-readable: "1 large egg", "1 packet", "1 scoop". */
  servingDescription: string;
  servingAmount: number;
  servingUnit: string;
  /** Grams in one base serving. Null when a food has no meaningful weight. */
  servingWeightGrams: number | null;

  dataSource: DataSource;
  externalFoodId: string | null;
  verificationStatus: VerificationStatus;
  /** 0–1. Only meaningful for ai_estimated foods. */
  confidenceScore: number | null;
  labelImageUrl: string | null;

  isFavorite: boolean;
  isActive: boolean;
  useCount: number;
  lastUsedAt: string | null;

  createdAt: string;
  updatedAt: string;
};

/** A food as it exists before it has an id — what the create form produces. */
export type NewFood = Omit<
  Food,
  "id" | "createdAt" | "updatedAt" | "useCount" | "lastUsedAt"
>;

/**
 * One logged food.
 *
 * The *_snapshot fields freeze the nutrition at the moment of logging, so
 * correcting a food's label later never rewrites history.
 */
export type FoodLog = {
  id: string;
  userId: string;
  foodId: string;
  /** YYYY-MM-DD in the user's local timezone. */
  logDate: string;
  mealCategory: MealCategory;
  quantity: number;

  nameSnapshot: string;
  servingDescriptionSnapshot: string;
  caloriesSnapshot: number;
  proteinSnapshot: number;
  fatSnapshot: number;
  carbsSnapshot: number;
  fiberSnapshot: number;

  // Null when the food had no value recorded — never silently zero.
  sugarSnapshot: number | null;
  saturatedFatSnapshot: number | null;
  cholesterolMgSnapshot: number | null;
  sodiumMgSnapshot: number | null;
  potassiumMgSnapshot: number | null;

  createdAt: string;
  updatedAt: string;
};

/** Derived cache, rebuildable from foodLogs alone. */
export type DailyTotals = MacroSet & {
  userId: string;
  /** YYYY-MM-DD, and also the document id. */
  date: string;
  entryCount: number;
  status: DayStatus;
  updatedAt: string;
};

/**
 * Calendar and dashboard state.
 *
 * Note there is no "over" — reaching a controlled surplus is the mission.
 */
export type DayStatus = "none" | "below" | "near" | "ontarget" | "surplus";

export type WeightLog = {
  id: string;
  userId: string;
  /** YYYY-MM-DD, and also the document id — one weigh-in per day. */
  date: string;
  weight: number;
  waistMeasurement: number | null;
  note: string | null;
  createdAt: string;
};

/** One progress photo per calendar month, keyed by YYYY-MM. */
export type ProgressPhoto = {
  id: string;
  userId: string;
  /** YYYY-MM, and also the document id. */
  monthKey: string;
  /** Local YYYY-MM-DD date on which the photo was taken. */
  photoDate: string;
  imageUrl: string;
  storagePath: string;
  /** A snapshot so an old comparison does not change with later weight edits. */
  weight: number | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * A smart-scale body composition reading.
 *
 * Every metric is nullable: scales differ in what they report, and a
 * screenshot may be cropped or partly unreadable. Null means the device did
 * not give us the number, which must never be shown as zero.
 *
 * `ratings` holds the device's OWN classification per metric ("Standard",
 * "Excellent"). Capturing the scale's wording avoids inventing clinical
 * thresholds the app has no business asserting.
 */
export type BodyComposition = {
  id: string;
  userId: string;
  /** YYYY-MM-DD, and also the document id — one reading per day. */
  date: string;

  bodyFatPercent: number | null;
  bmi: number | null;
  muscleMassLb: number | null;
  visceralFat: number | null;
  bodyWaterPercent: number | null;
  subcutaneousFatPercent: number | null;
  skeletalMusclePercent: number | null;
  boneMassLb: number | null;
  fatFreeMassLb: number | null;
  bmrKcal: number | null;
  proteinPercent: number | null;
  metabolicAge: number | null;

  ratings: Record<string, string> | null;
  source: "ai_screenshot" | "manual";
  createdAt: string;
};

export type WeightUnit = "lb" | "kg";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type Profile = {
  userId: string;
  name: string;
  startingWeight: number;
  goalWeight: number;
  startingDate: string;
  targetDate: string | null;
  heightInches: number | null;
  birthDate: string | null;
  sex: "male" | "female" | "other" | null;
  activityLevel: ActivityLevel;
  workoutDaysPerWeek: number;
  weightUnit: WeightUnit;

  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  dailyFatTarget: number;

  createdAt: string;
  updatedAt: string;
};

export type MacroTargets = {
  calories: number;
  protein: number;
  fat: number;
};

export type MealTemplate = {
  id: string;
  userId: string;
  name: string;
  defaultMealCategory: MealCategory;
  /**
   * How many portions the listed quantities make.
   *
   * 1 means the ingredients are already per-serving — the original template
   * behaviour. Above 1 makes it a recipe: quantities describe the whole batch,
   * and logging a portion divides by this. That is what lets a tablespoon of
   * oil cook four bowls without charging a tablespoon to each.
   */
  servingsPrepared: number;
  createdAt: string;
};

export type MealTemplateItem = {
  id: string;
  templateId: string;
  foodId: string;
  quantity: number;
  order: number;
};

export type AiFoodSearch = {
  id: string;
  userId: string;
  searchQuery: string | null;
  imageUrl: string | null;
  suggestedResult: string;
  dataSource: DataSource;
  confidenceScore: number | null;
  approved: boolean;
  createdAt: string;
};
