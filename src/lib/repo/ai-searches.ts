import { addDoc, collection } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { DataSource } from "@/types";

/**
 * Audit trail for every AI suggestion.
 *
 * Worth keeping: when a number later looks wrong, this is what tells you
 * whether it came from a label, a description, or an estimate — and what the
 * model actually proposed before it was edited.
 */
export async function logAiSearch(
  userId: string,
  entry: {
    searchQuery: string | null;
    imageUrl?: string | null;
    suggestedResult: string;
    dataSource: DataSource;
    confidenceScore: number | null;
    approved: boolean;
  },
): Promise<void> {
  try {
    await addDoc(collection(getDb(), "aiFoodSearches"), {
      userId,
      imageUrl: null,
      ...entry,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // An audit-log failure must never block saving the food itself.
  }
}
