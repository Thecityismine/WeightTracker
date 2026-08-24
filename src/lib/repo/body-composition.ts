import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  bodyCompositionInputSchema,
  type BodyCompositionInput,
} from "@/lib/schemas";
import type { DateKey } from "@/lib/dates";
import type { BodyComposition } from "@/types";

const COMPOSITIONS = "bodyCompositions";

/**
 * One reading per day, keyed by date — same rule as weigh-ins. Stepping on
 * the scale twice in a morning should correct the record, not duplicate it.
 */
export async function saveComposition(
  userId: string,
  input: BodyCompositionInput,
): Promise<void> {
  const parsed = bodyCompositionInputSchema.parse(input);
  await setDoc(doc(getDb(), COMPOSITIONS, parsed.date), {
    userId,
    ...parsed,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteComposition(date: DateKey): Promise<void> {
  await deleteDoc(doc(getDb(), COMPOSITIONS, date));
}

/** Oldest first. Small enough to sort in memory, so no index is needed. */
export async function listCompositions(
  userId: string,
): Promise<BodyComposition[]> {
  const snap = await getDocs(
    query(collection(getDb(), COMPOSITIONS), where("userId", "==", userId)),
  );

  const rows = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as BodyComposition,
  );
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
