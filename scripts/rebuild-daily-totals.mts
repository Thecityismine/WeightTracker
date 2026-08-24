/**
 * Rebuild every dailyTotals document from the food logs.
 *
 * Usage:
 *   npm run rebuild-totals
 *
 * dailyTotals is a cache and must always be reproducible from foodLogs alone.
 * This script is the proof of that: run it any time the calendar looks wrong,
 * or after changing how a total is computed.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { dayStatus, sumMacros } from "../src/lib/nutrition.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\nMissing ${name}. See SETUP.md.\n`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const userId = requireEnv("ALLOWED_UID");

  const calorieTarget = Number(process.env.DAILY_CALORIE_TARGET ?? 2800);

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  const db = getFirestore();

  const logs = await db.collection("foodLogs").where("userId", "==", userId).get();

  // Group every log by its date.
  const byDate = new Map<string, FirebaseFirestore.DocumentData[]>();
  for (const doc of logs.docs) {
    const d = doc.data();
    const list = byDate.get(d.logDate) ?? [];
    list.push(d);
    byDate.set(d.logDate, list);
  }

  console.log(`Rebuilding ${byDate.size} days from ${logs.size} logs...\n`);

  const now = new Date().toISOString();
  for (const [date, dayLogs] of byDate) {
    const totals = sumMacros(
      dayLogs.map((l) => ({
        calories: l.caloriesSnapshot,
        protein: l.proteinSnapshot,
        fat: l.fatSnapshot,
        carbs: l.carbsSnapshot,
        fiber: l.fiberSnapshot,
      })),
    );

    await db.collection("dailyTotals").doc(date).set({
      userId,
      date,
      ...totals,
      entryCount: dayLogs.length,
      status: dayStatus(totals.calories, calorieTarget, dayLogs.length > 0),
      updatedAt: now,
    });

    console.log(
      `  ${date}  ${Math.round(totals.calories)} kcal  ${dayLogs.length} entries`,
    );
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
