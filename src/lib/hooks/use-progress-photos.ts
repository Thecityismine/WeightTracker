"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { ProgressPhoto } from "@/types";

type State = { key: string; photos: ProgressPhoto[] };

export function useProgressPhotos(userId: string | null) {
  const key = userId ?? "";
  const [state, setState] = useState<State>({ key: "", photos: [] });

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(getDb(), "progressPhotos"),
      where("userId", "==", userId),
    );
    return onSnapshot(
      q,
      (snap) => {
        const photos = snap.docs.map(
          (item) => ({ id: item.id, ...item.data() }) as ProgressPhoto,
        );
        photos.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
        setState({ key, photos });
      },
      () => setState({ key, photos: [] }),
    );
  }, [userId, key]);

  return {
    photos: state.key === key ? state.photos : [],
    loading: state.key !== key,
  };
}
