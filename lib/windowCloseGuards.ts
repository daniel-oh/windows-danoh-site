// Per-window close interceptors. A program registers a guard when it
// has state worth protecting (e.g. Mail with an unsent draft); every
// close path — title-bar X, Esc, taskbar, menu Close — flows through
// windowsListAtom's REMOVE, which consults the guard. Returning false
// vetoes the close; the guard is expected to show its own confirm UI
// and re-dispatch REMOVE with force: true if the user opts to discard.
//
// A plain module-level Map rather than an atom: guards hold component
// closures, are never rendered, and must be readable synchronously
// from inside another atom's write function.

const guards = new Map<string, () => boolean>();

/** Returns an unregister function — call it in the effect cleanup. */
export function registerCloseGuard(
  id: string,
  guard: () => boolean
): () => void {
  guards.set(id, guard);
  return () => {
    // Only delete if it's still our guard (a re-render may have
    // registered a newer one before this cleanup ran).
    if (guards.get(id) === guard) guards.delete(id);
  };
}

/** true = proceed with the close. */
export function runCloseGuard(id: string): boolean {
  const guard = guards.get(id);
  return guard ? guard() : true;
}

export function clearCloseGuard(id: string) {
  guards.delete(id);
}
