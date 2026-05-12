import { useEffect, type RefObject } from "react";

// Constrains Tab / Shift+Tab so focus cycles within the container
// instead of escaping into the page behind it. Matches the OS
// metaphor — Tab moves between controls inside the focused window;
// switching windows happens via click or (eventually) the taskbar.
//
// Gated on isActive so only the currently-focused window installs
// the trap; background windows let focus pass through. Listens at
// the document level (not the container) so a Tab fired from
// anywhere can still be caught and redirected.

const FOCUSABLE = [
  "a[href]",
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean
): void {
  useEffect(() => {
    if (!isActive) return;
    const el = containerRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      // Only trap if focus is already inside the container. If the
      // visitor's focus is somewhere else (another window, the
      // taskbar, the desktop), let Tab behave normally.
      const active = document.activeElement as HTMLElement | null;
      if (!active || !el.contains(active)) return;

      // Visible-and-tabbable subset. offsetParent === null filters
      // out display:none ancestors; the el itself is excluded since
      // it carries tabIndex={-1} and isn't part of the cycle.
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((n) => n.offsetParent !== null && n !== el);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [containerRef, isActive]);
}
