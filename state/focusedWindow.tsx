"use client";
import { atom } from "jotai";

// Internal storage for the currently focused window.
const _focusedAtom = atom<string | null>(null);

// Monotonic z-order map. Any time a window is focused (or created and
// focused), it gets the next z-index — this gives us proper bring-to-front
// stacking instead of the old focused/unfocused 0-or-1 toggle.
const _zMapAtom = atom<Record<string, number>>({});
const _nextZAtom = atom(1);

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
    if (next) {
      const z = get(_nextZAtom);
      set(_zMapAtom, { ...get(_zMapAtom), [next]: z });
      set(_nextZAtom, z + 1);
    }
  }
);

export const zOrderAtom = atom((get) => get(_zMapAtom));
