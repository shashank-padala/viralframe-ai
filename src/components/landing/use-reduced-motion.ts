"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks the OS "reduce motion" preference.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: matchMedia is
 * an external store, so this is what it exists for. It avoids the extra
 * render that setting state on mount costs, and it forces an explicit answer
 * for the server render, where no media query can be evaluated.
 *
 * The server snapshot is `true` deliberately -- assume reduced motion until
 * the client says otherwise, so nothing animates unasked on first paint.
 */
export function useReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  );
}
