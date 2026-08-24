import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { computeLogMacros, dayStatus, sumMacros } from "@/lib/nutrition";
import { foodLogInputSchema, type FoodLogInput } from "@/lib/schemas";
import type { DateKey } from "@/lib/dates";
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
  const snap = await getDocs(
    query(
      collection(getDb(), LOGS),
      where("userId", "==", userId),
      where("logDate", "==", date),
      orderBy("createdAt", "asc"),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FoodLog);
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
