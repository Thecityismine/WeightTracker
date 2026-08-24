"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR and the first client render, true afterwards.
 *
 * Use it to gate anything that depends on the local clock or device state —
 * the server has no idea what time it is in the user's kitchen, and rendering
 * its guess would produce a hydration mismatch.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
