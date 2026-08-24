import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { weightLogInputSchema, type WeightLogInput } from "@/lib/schemas";
import type { DateKey } from "@/lib/dates";
import type { WeightLog } from "@/types";

const WEIGHTS = "weightLogs";

/**
 * One weigh-in per day, with the date as the document id. Re-entering a
 * weight for the same day overwrites cleanly instead of creating a duplicate.
 */
export async function saveWeight(
  userId: string,
  input: WeightLogInput,
): Promise<void> {
  const parsed = weightLogInputSchema.parse(input);
  await setDoc(doc(getDb(), WEIGHTS, parsed.date), {
    userId,
    ...parsed,
    createdAt: serverTimestamp(),
  });
}

export async function getWeight(date: DateKey): Promise<WeightLog | null> {
  const snap = await getDoc(doc(getDb(), WEIGHTS, date));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as WeightLog)
    : null;
}

export async function deleteWeight(date: DateKey): Promise<void> {
  await deleteDoc(doc(getDb(), WEIGHTS, date));
}

/** Most recent first. */
export async function listWeights(
  userId: string,
  max = 120,
): Promise<WeightLog[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), WEIGHTS),
      where("userId", "==", userId),
      orderBy("date", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WeightLog);
}
