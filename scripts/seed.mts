/**
 * Seed the food database.
 *
 * Usage:
 *   node --experimental-strip-types --env-file=.env.local scripts/seed.ts
 *   npm run seed
 *
 * Requires FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY and ALLOWED_UID.
 * Safe to re-run: foods are keyed by name + brand, so existing entries are
 * updated rather than duplicated, and useCount is never reset.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SEED_FOODS } from "../src/data/seed-foods.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\nMissing ${name}.`);
    console.error("Fill it in .env.local — see SETUP.md.\n");
    process.exit(1);
  }
  return value;
}

async function main() {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const userId = requireEnv("ALLOWED_UID");

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const db = getFirestore();

  console.log(`Seeding ${SEED_FOODS.length} foods into ${projectId}...\n`);

  const existing = await db.collection("foods").where("userId", "==", userId).get();
  const byKey = new Map<string, string>();
  for (const doc of existing.docs) {
    const d = doc.data();
    byKey.set(`${d.name}::${d.brand ?? ""}`, doc.id);
  }

  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const food of SEED_FOODS) {
    const key = `${food.name}::${food.brand ?? ""}`;
    const existingId = byKey.get(key);

    if (existingId) {
      // Refresh the nutrition but leave usage history alone.
      await db.collection("foods").doc(existingId).set(
        { ...food, userId, updatedAt: now },
        { merge: true },
      );
      updated++;
    } else {
      await db.collection("foods").add({
        ...food,
        userId,
        useCount: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
  }

  console.log(`  created ${created}`);
  console.log(`  updated ${updated}`);
  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
