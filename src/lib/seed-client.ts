"use client";

import { collection, getDocs, query, where, writeBatch, doc } from "firebase/firestore";
import { getDb } from "./firebase";
import { SEED_FOODS } from "@/data/seed-foods";
import { foodInputSchema } from "./schemas";

/**
 * Load the starter foods from inside the app.
 *
 * `scripts/seed.mts` does the same thing with the Admin SDK, but that needs a
 * service-account key. This path runs as the signed-in owner, so the security
 * rules already permit it and no extra credential is involved.
 *
 * Idempotent: keyed on name + brand, so re-running adds only what is missing
 * and never disturbs useCount or favorites on foods already there.
 */
export async function loadStarterFoods(
  userId: string,
): Promise<{ created: number; skipped: number }> {
  const db = getDb();

  const existing = await getDocs(
    query(collection(db, "foods"), where("userId", "==", userId)),
  );
  const seen = new Set(
    existing.docs.map((d) => {
      const data = d.data();
      return `${data.name}::${data.brand ?? ""}`;
    }),
  );

  const missing = SEED_FOODS.filter(
    (f) => !seen.has(`${f.name}::${f.brand ?? ""}`),
  );

  if (missing.length === 0) {
    return { created: 0, skipped: SEED_FOODS.length };
  }

  const now = new Date().toISOString();

  // Firestore batches cap at 500 writes; 41 foods fits, but chunk anyway so
  // this keeps working as the starter set grows.
  for (let i = 0; i < missing.length; i += 400) {
    const batch = writeBatch(db);
    for (const food of missing.slice(i, i + 400)) {
      // Parse rather than spread raw: this applies the schema defaults, so a
      // newly added optional field is stored as null instead of missing.
      batch.set(doc(collection(db, "foods")), {
        ...foodInputSchema.parse(food),
        userId,
        useCount: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();
  }

  return { created: missing.length, skipped: SEED_FOODS.length - missing.length };
}
