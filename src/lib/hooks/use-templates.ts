"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { TemplateDoc } from "@/lib/repo/meal-templates";

type State = { key: string; templates: TemplateDoc[] };

/**
 * Live meal templates.
 *
 * Items live in an array on the template document rather than a subcollection:
 * a template is a handful of ingredients read as a unit, and a subcollection
 * would mean one extra listener per template for no gain.
 */
export function useTemplates(userId: string | null) {
  const key = userId ?? "";
  const [state, setState] = useState<State>({ key: "", templates: [] });

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(getDb(), "mealTemplates"),
      where("userId", "==", userId),
    );

    return onSnapshot(
      q,
      (snap) => {
        const templates = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as TemplateDoc,
        );
        templates.sort((a, b) => a.name.localeCompare(b.name));
        setState({ key, templates });
      },
      () => setState({ key, templates: [] }),
    );
  }, [userId, key]);

  const ready = state.key === key;
  return { templates: ready ? state.templates : [], loading: !ready };
}
