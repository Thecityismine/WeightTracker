"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MealCategory } from "@/lib/constants";
import type { DateKey } from "@/lib/dates";
import { todayKey } from "@/lib/dates";

type PickerState = {
  open: boolean;
  meal: MealCategory;
  date: DateKey;
};

type PickerApi = PickerState & {
  /** Open the food picker targeting a meal, and optionally a past date. */
  openPicker: (meal: MealCategory, date?: DateKey) => void;
  closePicker: () => void;
};

const Ctx = createContext<PickerApi | null>(null);

/**
 * One shared picker, opened from several places: each meal's "Add food"
 * button, and the elevated + in the bottom nav.
 */
export function FoodPickerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PickerState>({
    open: false,
    meal: "breakfast",
    date: todayKey(),
  });

  const openPicker = useCallback((meal: MealCategory, date?: DateKey) => {
    setState({ open: true, meal, date: date ?? todayKey() });
  }, []);

  const closePicker = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const value = useMemo(
    () => ({ ...state, openPicker, closePicker }),
    [state, openPicker, closePicker],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFoodPicker(): PickerApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFoodPicker must be used inside FoodPickerProvider");
  return ctx;
}
