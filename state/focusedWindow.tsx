"use client";
import { atom } from "jotai";

// Internal storage for the currently focused window.
const _focusedAtom = atom<string | null>(null);

// Monotonic z-order map. Any time a window is focused (or created and
// focused), it gets the next z-index — this gives us proper bring-to-front
// stacking instead of the old focused/unfocused 0-or-1 toggle.
const _zMapAtom = atom<Record<string, number>>({});
const _nextZAtom = atom(1);
// Well under the taskbar (z-index 1000 in OS.module.css), even with every
// window counted.
const RENUMBER_AT = 500;

export const focusedWindowAtom = atom(
  (get) => get(_focusedAtom),
  (
    get,
    set,
    update: string | null | ((prev: string | null) => string | null)
  ) => {
    const prev = get(_focusedAtom);
    const next = typeof update === "function" ? update(prev) : update;
    set(_focusedAtom, next);
    if (!next) return;
    let zMap = get(_zMapAtom);
    // Already in front: nothing to raise. Every press used to bump the
    // counter (a click twice, a tap up to four times), and past the
    // taskbar's z-index of 1000 windows covered the taskbar and the Start
    // menu, a few Minesweeper games in.
    const top = Math.max(0, ...Object.values(zMap));
    if (zMap[next] !== undefined && zMap[next] === top) return;
    let z = get(_nextZAtom);
    if (z > RENUMBER_AT) {
      // Squeeze the stack back to 1..N, same order.
      const order = Object.entries(zMap).sort((a, b) => a[1] - b[1]);
      zMap = Object.fromEntries(order.map(([id], i) => [id, i + 1]));
      z = order.length + 1;
    }
    set(_zMapAtom, { ...zMap, [next]: z });
    set(_nextZAtom, z + 1);
  }
);

export const zOrderAtom = atom((get) => get(_zMapAtom));

// Cleanup for a closed window: clear focus if it pointed here and drop
// the z-order entry. Without this, focus keeps referencing the dead id
// (Esc would "close" it again) and the z map grows for the session.
export const pruneWindowFocusAtom = atom(null, (get, set, id: string) => {
  if (get(_focusedAtom) === id) {
    set(_focusedAtom, null);
  }
  const zMap = get(_zMapAtom);
  if (id in zMap) {
    const { [id]: _removed, ...rest } = zMap;
    set(_zMapAtom, rest);
  }
});
