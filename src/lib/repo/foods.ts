import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { foodInputSchema, type FoodInput } from "@/lib/schemas";
import type { Food } from "@/types";

const FOODS = "foods";

function toFood(id: string, data: Record<string, unknown>): Food {
  return { id, ...data } as Food;
}

export async function getFood(foodId: string): Promise<Food | null> {
  const snap = await getDoc(doc(getDb(), FOODS, foodId));
  return snap.exists() ? toFood(snap.id, snap.data()) : null;
}

export async function listFoods(userId: string): Promise<Food[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), FOODS),
      where("userId", "==", userId),
      where("isActive", "==", true),
      orderBy("useCount", "desc"),
    ),
  );
  return snap.docs.map((d) => toFood(d.id, d.data()));
}

export async function listFavorites(userId: string): Promise<Food[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), FOODS),
      where("userId", "==", userId),
      where("isFavorite", "==", true),
      orderBy("name", "asc"),
    ),
  );
  return snap.docs.map((d) => toFood(d.id, d.data()));
}

/** Recent tab — most-used first, which in practice is what gets eaten daily. */
export async function listRecent(userId: string, max = 20): Promise<Food[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), FOODS),
      where("userId", "==", userId),
      where("isActive", "==", true),
      orderBy("useCount", "desc"),
      limit(max),
    ),
  );
  return snap.docs.map((d) => toFood(d.id, d.data()));
}

export async function createFood(
  userId: string,
  input: FoodInput,
): Promise<string> {
  const parsed = foodInputSchema.parse(input);
  const now = new Date().toISOString();
  const ref = await addDoc(collection(getDb(), FOODS), {
    ...parsed,
    userId,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateFood(
  foodId: string,
  input: FoodInput,
): Promise<void> {
  const parsed = foodInputSchema.parse(input);
  await updateDoc(doc(getDb(), FOODS, foodId), {
    ...parsed,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Archive rather than delete.
 *
 * Logs keep their own nutrition snapshots, but a hard delete would still
 * orphan the foodId and break "log this again" from history.
 */
export async function archiveFood(foodId: string): Promise<void> {
  await updateDoc(doc(getDb(), FOODS, foodId), {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function toggleFavorite(
  foodId: string,
  isFavorite: boolean,
): Promise<void> {
  await updateDoc(doc(getDb(), FOODS, foodId), {
    isFavorite,
    updatedAt: new Date().toISOString(),
  });
}

/** Called whenever a food is logged, so Recent stays ordered by real use. */
export async function recordUse(foodId: string): Promise<void> {
  await updateDoc(doc(getDb(), FOODS, foodId), {
    useCount: increment(1),
    lastUsedAt: new Date().toISOString(),
  });
}
