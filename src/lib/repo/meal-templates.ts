import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { addLogs } from "./food-logs";
import { computeLogMacros, sumMacros } from "@/lib/nutrition";
import type { MealCategory } from "@/lib/constants";
import type { DateKey } from "@/lib/dates";
import type { Food, MacroSet, MacroTargets, MealTemplate } from "@/types";

const TEMPLATES = "mealTemplates";

/**
 * Template items reference a food by id and quantity — they do NOT snapshot
 * nutrition. That is deliberate and the opposite of a food log: a log records
 * what was eaten and must never change, while a template is a recipe for what
 * you are *about* to eat, so it should pick up any label correction made since.
 */
export type TemplateItem = {
  foodId: string;
  quantity: number;
};

export type TemplateDoc = MealTemplate & { items: TemplateItem[] };

export async function createTemplate(
  userId: string,
  name: string,
  defaultMealCategory: MealCategory,
  items: TemplateItem[],
): Promise<string> {
  const ref = await addDoc(collection(getDb(), TEMPLATES), {
    userId,
    name: name.trim(),
    defaultMealCategory,
    items,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function updateTemplate(
  templateId: string,
  patch: Partial<Pick<TemplateDoc, "name" | "defaultMealCategory" | "items">>,
): Promise<void> {
  await updateDoc(doc(getDb(), TEMPLATES, templateId), patch);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await deleteDoc(doc(getDb(), TEMPLATES, templateId));
}

/**
 * Add every ingredient to the day, in one batch.
 *
 * Items whose food has since been archived or deleted are skipped and
 * reported rather than silently dropped — a template that quietly logs five
 * of six ingredients is worse than one that says so.
 */
export async function applyTemplate(
  userId: string,
  template: TemplateDoc,
  foods: Food[],
  date: DateKey,
  meal: MealCategory,
  targets: MacroTargets,
): Promise<{ added: number; missing: number }> {
  const entries: { food: Food; quantity: number; mealCategory: MealCategory }[] =
    [];
  let missing = 0;

  for (const item of template.items) {
    const food = foods.find((f) => f.id === item.foodId);
    if (!food) {
      missing++;
      continue;
    }
    entries.push({ food, quantity: item.quantity, mealCategory: meal });
  }

  const added = await addLogs(userId, entries, date, targets);
  return { added, missing };
}

/** Totals for a template, computed from the foods it currently points at. */
export function templateMacros(
  template: TemplateDoc,
  foods: Food[],
): MacroSet {
  return sumMacros(
    template.items.map((item) => {
      const food = foods.find((f) => f.id === item.foodId);
      return food ? computeLogMacros(food, item.quantity) : {};
    }),
  );
}
