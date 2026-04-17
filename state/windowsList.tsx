import { assertNever } from "@/lib/assertNever";
import { atom } from "jotai";
import { windowAtomFamily } from "./window";
import {
  recycleBinAtom,
  RECYCLE_BIN_LIMIT,
  type RecycleBinEntry,
} from "./recycleBin";

export type WindowsListState = string[];

export type WindowsListAction =
  | { type: "ADD"; payload: string }
  | { type: "REMOVE"; payload: string };

// Program types that should NOT be resurrected from the Recycle Bin —
// transient dialogs and help/chat overlays that only make sense in
// their moment. Closing one of these cleans it up fully.
const NON_RECYCLABLE = new Set<string>(["alert", "help", "history"]);

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
        const win = get(windowAtomFamily(id));
        if (win && !NON_RECYCLABLE.has(win.program.type)) {
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
        return;
      }
      default:
        assertNever(action);
    }
  }
);
