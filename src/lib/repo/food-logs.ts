import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  computeExtendedMacros,
  computeLogMacros,
  dayStatus,
  sumMacros,
} from "@/lib/nutrition";
import { foodLogInputSchema, type FoodLogInput } from "@/lib/schemas";
import type { DateKey } from "@/lib/dates";
import type { MealCategory } from "@/lib/constants";
import type { DailyTotals, Food, FoodLog, MacroTargets } from "@/types";

const LOGS = "foodLogs";
const TOTALS = "dailyTotals";

/**
 * Food log reads and writes.
 *
 * Every mutation ends by recomputing that day's `dailyTotals` from the logs
 * themselves, so the cache can never drift from the source of truth.
 */

export async function listLogsForDate(
  userId: string,
  date: DateKey,
): Promise<FoodLog[]> {
  // Sorted in memory rather than with orderBy. Two equality filters plus an
  // ordering needs a three-field composite index, and this function runs on
  // every single log write via rebuildDailyTotals — so a missing index breaks
  // adding food entirely. A day holds a few dozen entries; sorting them here
  // costs nothing and removes the dependency.
  const snap = await getDocs(
    query(
      collection(getDb(), LOGS),
      where("userId", "==", userId),
      where("logDate", "==", date),
    ),
  );

  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FoodLog);
  rows.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  return rows;
}

/** Every log in a date range — the monthly report's source data. */
export async function listLogsForRange(
  userId: string,
  from: DateKey,
  to: DateKey,
): Promise<FoodLog[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), LOGS),
      where("userId", "==", userId),
      where("logDate", ">=", from),
      where("logDate", "<=", to),
    ),
  );

  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FoodLog);
  rows.sort(
    (a, b) =>
      a.logDate.localeCompare(b.logDate) ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );
  return rows;
}

/**
 * Log a food.
 *
 * The snapshot fields freeze this food's nutrition as it is right now.
 * Correcting the food later must never rewrite what was already eaten.
 */
export async function addLog(
  userId: string,
  food: Food,
  input: FoodLogInput,
  targets: MacroTargets,
): Promise<string> {
  const parsed = foodLogInputSchema.parse(input);
  const macros = computeLogMacros(food, parsed.quantity);
  const extra = computeExtendedMacros(food, parsed.quantity);
  // ISO strings rather than serverTimestamp(): a pending server timestamp
  // reads as null locally, so an optimistic row would sort to the top and
  // then visibly jump once the write lands. Single user, so no clock skew.
  const now = new Date().toISOString();

  const ref = await addDoc(collection(getDb(), LOGS), {
    userId,
    foodId: parsed.foodId,
    logDate: parsed.logDate,
    mealCategory: parsed.mealCategory,
    quantity: parsed.quantity,

    nameSnapshot: food.name,
    servingDescriptionSnapshot: food.servingDescription,
    caloriesSnapshot: macros.calories,
    proteinSnapshot: macros.protein,
    fatSnapshot: macros.fat,
    carbsSnapshot: macros.carbs,
    fiberSnapshot: macros.fiber,

    sugarSnapshot: extra.sugar,
    saturatedFatSnapshot: extra.saturatedFat,
    cholesterolMgSnapshot: extra.cholesterolMg,
    sodiumMgSnapshot: extra.sodiumMg,

    createdAt: now,
    updatedAt: now,
  });

  await rebuildDailyTotals(userId, parsed.logDate, targets);
  return ref.id;
}

/** Change a quantity in place — the tap-to-edit path on the Today screen. */
export async function updateLogQuantity(
  userId: string,
  logId: string,
  quantity: number,
  targets: MacroTargets,
): Promise<void> {
  const ref = doc(getDb(), LOGS, logId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Log ${logId} not found`);

  const log = snap.data() as FoodLog;

  // Rescale from the stored snapshot, not from the food's current values —
  // editing a portion must not silently pull in a later label correction.
  const perServing = {
    caloriesPerServing: log.caloriesSnapshot / log.quantity,
    proteinPerServing: log.proteinSnapshot / log.quantity,
    fatPerServing: log.fatSnapshot / log.quantity,
    carbsPerServing: log.carbsSnapshot / log.quantity,
    fiberPerServing: log.fiberSnapshot / log.quantity,
  };
  const macros = computeLogMacros(perServing, quantity);

  await updateDoc(ref, {
    quantity,
    caloriesSnapshot: macros.calories,
    proteinSnapshot: macros.protein,
    fatSnapshot: macros.fat,
    carbsSnapshot: macros.carbs,
    fiberSnapshot: macros.fiber,
    updatedAt: new Date().toISOString(),
  });

  await rebuildDailyTotals(userId, log.logDate, targets);
}

export async function deleteLog(
  userId: string,
  logId: string,
  date: DateKey,
  targets: MacroTargets,
): Promise<void> {
  await deleteDoc(doc(getDb(), LOGS, logId));
  await rebuildDailyTotals(userId, date, targets);
}

/**
 * Write several logs at once, rebuilding that day's totals a single time.
 *
 * Applying a six-ingredient template through addLog() would recompute the
 * day's totals six times — six full day reads for one user action.
 */
export async function addLogs(
  userId: string,
  entries: { food: Food; quantity: number; mealCategory: MealCategory }[],
  date: DateKey,
  targets: MacroTargets,
): Promise<number> {
  if (entries.length === 0) return 0;
  const now = new Date().toISOString();

  for (const { food, quantity, mealCategory } of entries) {
    const macros = computeLogMacros(food, quantity);
    const extra = computeExtendedMacros(food, quantity);
    await addDoc(collection(getDb(), LOGS), {
      userId,
      foodId: food.id,
      logDate: date,
      mealCategory,
      quantity,

      nameSnapshot: food.name,
      servingDescriptionSnapshot: food.servingDescription,
      caloriesSnapshot: macros.calories,
      proteinSnapshot: macros.protein,
      fatSnapshot: macros.fat,
      carbsSnapshot: macros.carbs,
      fiberSnapshot: macros.fiber,

      sugarSnapshot: extra.sugar,
      saturatedFatSnapshot: extra.saturatedFat,
      cholesterolMgSnapshot: extra.cholesterolMg,
      sodiumMgSnapshot: extra.sodiumMg,

      createdAt: now,
      updatedAt: now,
    });
  }

  await rebuildDailyTotals(userId, date, targets);
  return entries.length;
}

/**
 * Copy one meal from another day.
 *
 * Snapshots are copied verbatim, so yesterday's breakfast reproduces exactly
 * what was eaten rather than what the food says today.
 */
export async function copyMeal(
  userId: string,
  from: DateKey,
  to: DateKey,
  meal: MealCategory,
  targets: MacroTargets,
): Promise<number> {
  const source = (await listLogsForDate(userId, from)).filter(
    (l) => l.mealCategory === meal,
  );
  if (source.length === 0) return 0;

  const now = new Date().toISOString();

  for (const log of source) {
    await addDoc(collection(getDb(), LOGS), {
      userId,
      foodId: log.foodId,
      logDate: to,
      mealCategory: meal,
      quantity: log.quantity,

      nameSnapshot: log.nameSnapshot,
      servingDescriptionSnapshot: log.servingDescriptionSnapshot,
      caloriesSnapshot: log.caloriesSnapshot,
      proteinSnapshot: log.proteinSnapshot,
      fatSnapshot: log.fatSnapshot,
      carbsSnapshot: log.carbsSnapshot,
      fiberSnapshot: log.fiberSnapshot,

      sugarSnapshot: log.sugarSnapshot ?? null,
      saturatedFatSnapshot: log.saturatedFatSnapshot ?? null,
      cholesterolMgSnapshot: log.cholesterolMgSnapshot ?? null,
      sodiumMgSnapshot: log.sodiumMgSnapshot ?? null,

      createdAt: now,
      updatedAt: now,
    });
  }

  await rebuildDailyTotals(userId, to, targets);
  return source.length;
}

/**
 * Copy every food from one day onto another.
 *
 * The snapshots are copied verbatim rather than recomputed from the current
 * foods, so a day copied forward reproduces exactly what was eaten — even if
 * a label has been corrected since.
 */
export async function copyDay(
  userId: string,
  from: DateKey,
  to: DateKey,
  targets: MacroTargets,
): Promise<number> {
  const source = await listLogsForDate(userId, from);
  if (source.length === 0) return 0;

  const now = new Date().toISOString();

  for (const log of source) {
    await addDoc(collection(getDb(), LOGS), {
      userId,
      foodId: log.foodId,
      logDate: to,
      mealCategory: log.mealCategory,
      quantity: log.quantity,

      nameSnapshot: log.nameSnapshot,
      servingDescriptionSnapshot: log.servingDescriptionSnapshot,
      caloriesSnapshot: log.caloriesSnapshot,
      proteinSnapshot: log.proteinSnapshot,
      fatSnapshot: log.fatSnapshot,
      carbsSnapshot: log.carbsSnapshot,
      fiberSnapshot: log.fiberSnapshot,

      sugarSnapshot: log.sugarSnapshot ?? null,
      saturatedFatSnapshot: log.saturatedFatSnapshot ?? null,
      cholesterolMgSnapshot: log.cholesterolMgSnapshot ?? null,
      sodiumMgSnapshot: log.sodiumMgSnapshot ?? null,

      createdAt: now,
      updatedAt: now,
    });
  }

  await rebuildDailyTotals(userId, to, targets);
  return source.length;
}

/**
 * Recompute one day's totals from its logs.
 *
 * `dailyTotals` is a cache and nothing more. This function is the definition
 * of that cache, and `scripts/rebuild-daily-totals.ts` calls it in bulk.
 */
export async function rebuildDailyTotals(
  userId: string,
  date: DateKey,
  targets: MacroTargets,
): Promise<DailyTotals> {
  const logs = await listLogsForDate(userId, date);

  const totals = sumMacros(
    logs.map((l) => ({
      calories: l.caloriesSnapshot,
      protein: l.proteinSnapshot,
      fat: l.fatSnapshot,
      carbs: l.carbsSnapshot,
      fiber: l.fiberSnapshot,
    })),
  );

  const record: Omit<DailyTotals, "updatedAt"> = {
    userId,
    date,
    ...totals,
    entryCount: logs.length,
    status: dayStatus(totals.calories, targets.calories, logs.length > 0),
  };

  const updatedAt = new Date().toISOString();
  await setDoc(doc(getDb(), TOTALS, date), { ...record, updatedAt });

  return { ...record, updatedAt };
}
