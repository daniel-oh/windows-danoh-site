import { assertNever } from "@/lib/assertNever";
import { atom } from "jotai";
import { windowAtomFamily } from "./window";
import { focusedWindowAtom, pruneWindowFocusAtom, zOrderAtom } from "./focusedWindow";
import { runCloseGuard, clearCloseGuard } from "@/lib/windowCloseGuards";
import {
  recycleBinAtom,
  RECYCLE_BIN_LIMIT,
  type RecycleBinEntry,
} from "./recycleBin";

export type WindowsListState = string[];

export type WindowsListAction =
  | { type: "ADD"; payload: string }
  // force skips the window's close guard — used by the guard's own
  // "Discard" confirmation so it doesn't re-veto itself.
  | { type: "REMOVE"; payload: string; force?: boolean };

// Program types that should NOT be resurrected from the Recycle Bin —
// transient dialogs and help/chat overlays that only make sense in
// their moment. Closing one of these cleans it up fully.
// run/settings joined the set: restoring a cancelled Run gate or a
// Settings panel from the "trash" is noise, not resurrection. Explorer
// windows carrying an action closure (Save/Open pickers) are excluded
// in the REMOVE handler since closures don't survive storage.
const NON_RECYCLABLE = new Set<string>([
  "alert",
  "help",
  "history",
  "run",
  "settings",
]);

const _listAtom = atom<WindowsListState>([]);

// Custom write-atom instead of atomWithReducer so we can read the full
// window state and push a snapshot to the Recycle Bin on REMOVE.
export const windowsListAtom = atom(
  (get) => get(_listAtom),
  (get, set, action: WindowsListAction) => {
    switch (action.type) {
      case "ADD":
        set(_listAtom, (prev) => [...prev, action.payload]);
        return;
      case "REMOVE": {
        const id = action.payload;
        // Idempotency guard: Esc (or a double-fired Close) can dispatch
        // REMOVE for an id that's already gone. Without this, each
        // repeat re-snapshots the stale window atom into the Recycle
        // Bin as a duplicate entry.
        if (!get(_listAtom).includes(id)) return;
        // Programs with unsaved state (Mail drafts) register a guard
        // that can veto the close and show its own confirm dialog.
        if (!action.force && !runCloseGuard(id)) return;
        const wasFocused = get(focusedWindowAtom) === id;
        const win = get(windowAtomFamily(id));
        const isActionPicker =
          win?.program.type === "explorer" && !!win.program.action;
        if (win && !NON_RECYCLABLE.has(win.program.type) && !isActionPicker) {
          const entry: RecycleBinEntry = {
            binId:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
            title: win.title,
            program: win.program,
            size: win.size,
            icon: win.icon,
            closedAt: Date.now(),
          };
          set(recycleBinAtom, (prev) =>
            [entry, ...prev].slice(0, RECYCLE_BIN_LIMIT)
          );
        }
        set(_listAtom, (prev) => prev.filter((v) => v !== id));
        set(pruneWindowFocusAtom, id);
        clearCloseGuard(id);
        // Focus restore: closing the focused window otherwise strands
        // keyboard/screen-reader users on <body>. Hand focus to the
        // top remaining non-minimized window, both in the atom and in
        // the DOM (deferred so React has committed the removal).
        if (wasFocused) {
          const remaining = get(_listAtom).filter(
            (w) => get(windowAtomFamily(w)).status !== "minimized"
          );
          if (remaining.length) {
            const z = get(zOrderAtom);
            const top = remaining.reduce((a, b) =>
              (z[a] ?? 0) >= (z[b] ?? 0) ? a : b
            );
            set(focusedWindowAtom, top);
            setTimeout(
              () =>
                document.getElementById(top)?.focus({ preventScroll: true }),
              0
            );
          }
        }
        // Window ids are random and never reused, so the per-window
        // atom can be dropped once closed — atomFamily retains every
        // member forever otherwise (alert ReactNodes, explorer action
        // closures, ...). Deferred so the unmounting Window component
        // isn't still subscribed when the atom is recreated-on-read.
        setTimeout(() => windowAtomFamily.remove(id), 0);
        return;
      }
      default:
        assertNever(action);
    }
  }
);
