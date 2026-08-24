"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginScreen } from "./login-screen";
import { BottomNav } from "@/components/nav/bottom-nav";
import { FoodPickerProvider } from "@/lib/food-picker-context";
import { AddFoodSheet } from "@/components/food-picker/add-food-sheet";

/**
 * Wraps the whole app. Three states: restoring the session, signed out,
 * signed in. The restoring state renders nothing but the background so a
 * refresh never flashes the login screen at an already-authenticated user.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-dvh" aria-busy="true" />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <FoodPickerProvider>
      {/* Bottom padding clears the nav bar plus the home indicator. */}
      <div className="min-h-dvh pb-[calc(80px+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
      <BottomNav />
      <AddFoodSheet />
    </FoodPickerProvider>
  );
}
