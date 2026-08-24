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
      {/*
        The iOS status bar is black-translucent so the background gradient
        reaches the top of the screen. That also means scrolled content
        passes under the clock. This scrim sits in the safe-area strip and
        keeps it legible.
      */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-50"
        style={{
          height: "env(safe-area-inset-top, 0px)",
          background: "rgba(5, 6, 8, 0.72)",
          backdropFilter: "blur(12px)",
        }}
      />
      {/* Bottom padding clears the nav bar plus the home indicator. */}
      <div className="min-h-dvh pt-safe pb-[calc(76px+env(safe-area-inset-bottom,0px))]">
        {children}
      </div>
      <BottomNav />
      <AddFoodSheet />
    </FoodPickerProvider>
  );
}
