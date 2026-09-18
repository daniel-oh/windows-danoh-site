import { useSyncExternalStore } from "react";

// True in the browser when the visitor has NOT asked for reduced motion.
// False during server rendering and hydration, so the server HTML is always
// the plain version and decorative effects only ever mount after it.
// Tracks the setting live if it changes while the page is open.

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useMotionAllowed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !window.matchMedia(QUERY).matches,
    () => false
  );
}
