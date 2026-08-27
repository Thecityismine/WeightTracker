import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  progressPhotoInputSchema,
  type ProgressPhotoInput,
} from "@/lib/schemas";
import type { ProgressPhoto } from "@/types";

const COLLECTION = "progressPhotos";

export async function saveProgressPhoto(
  userId: string,
  input: ProgressPhotoInput,
  existing?: ProgressPhoto | null,
): Promise<void> {
  const parsed = progressPhotoInputSchema.parse(input);
  const monthKey = parsed.photoDate.slice(0, 7);
  const now = new Date().toISOString();

  await setDoc(doc(getDb(), COLLECTION, monthKey), {
    userId,
    monthKey,
    ...parsed,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function deleteProgressPhoto(monthKey: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTION, monthKey));
}
