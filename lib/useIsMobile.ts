"use client";

import { useSyncExternalStore } from "react";
import { MOBILE_QUERY } from "./isMobile";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// Reactive isMobile(): re-renders on rotation/resize across the
// breakpoint instead of sampling once on mount. Server snapshot is
// false — the desktop layout is the SSR baseline, mobile attaches on
// hydration exactly like the old useState+useEffect pattern did.
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  );
}
