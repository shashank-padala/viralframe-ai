"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a media query.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: matchMedia is
 * an external store, so this is what it is for. It also avoids the
 * cascading render you get from setting state in an effect on mount, and it
 * forces an explicit answer for the server render, where no media query can
 * be evaluated.
 *
 * @param serverValue what to assume during SSR and first paint. Choose the
 * conservative option — assume reduced motion, assume small screen — so the
 * page never starts by doing something it should not.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}

/** Defaults to true before the client knows, so nothing animates unasked. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", true);
}

/** Defaults to false, so the phone experience is what renders first. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)", false);
}
