"use client";

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";

/** Matches storage.rules: images only, under 10 MB, in labels/{uid}/. */
const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadLabelImage(
  userId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("That image is larger than 10 MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `labels/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

/** Best-effort — a missing object should never block saving the food. */
export async function deleteLabelImage(url: string): Promise<void> {
  try {
    await deleteObject(ref(getFirebaseStorage(), url));
  } catch {
    // Already gone, or never ours to delete.
  }
}

export async function uploadProgressImage(
  userId: string,
  file: File,
): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("That image is larger than 10 MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `progress/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return { url: await getDownloadURL(storageRef), path };
}

export async function deleteStoredImage(path: string): Promise<void> {
  try {
    await deleteObject(ref(getFirebaseStorage(), path));
  } catch {
    // Best effort: database state must not be held hostage by a missing object.
  }
}
