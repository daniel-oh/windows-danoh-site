import { assert } from "@/lib/assert";
import { assertNever } from "@/lib/assertNever";
import { getDefaultStore } from "jotai";
import { atomWithReducer } from "jotai/utils";
import { atomFamily } from "jotai-family";
import { programAtomFamily, programsAtom } from "./programs";
import { ReactNode } from "react";

export type Program =
  | { type: "welcome" }
  | { type: "run"; initialPrompt?: string }
  | { type: "history"; programID: string }
  | { type: "iframe"; programID: string; canSave?: boolean; canOpen?: boolean }
  | { type: "help"; targetWindowID?: string }
  | { type: "settings" }
  | {
      type: "explorer";
      currentPath?: string;
      action?: (path: string) => void;
      actionText?: string;
    }
  | {
      type: "alert";
      message: ReactNode;
      alertId?: string;
      icon?: "x";
      actions?: AlertAction[];
    }
  | { type: "blog"; initialSlug?: string }
  | { type: "resume" }
  | { type: "shortcuts" }
  | { type: "mail" }
  | { type: "minesweeper" }
  | { type: "guestbook" }
  | { type: "recycle" };

export type AlertAction = {
  label: string;
  callback: (close: () => void) => void;
};
export type WindowState = {
  status: "maximized" | "minimized" | "normal";
  // The status to return to when un-minimizing. Captured on minimize so
  // a maximized window doesn't come back as a normal-sized one.
  restoreStatus?: "maximized" | "normal";
  pos: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number | "auto";
  };
  title: string;
  icon?: string;
  program: Program;
  id: string;
  loading: boolean;
  error?: string;
};

export type WindowAction =
  | { type: "SET_LOADING"; payload: boolean }
  // Convert an "auto" height into its live rendered pixel height before a
  // resize starts, so the first resize frame grows from the real size
  // instead of collapsing to the minimum. No-op once height is numeric.
  | { type: "MATERIALIZE_HEIGHT"; payload: number }
  | { type: "TOGGLE_MAXIMIZE" }
  | { type: "TOGGLE_MINIMIZE" }
  | { type: "RESTORE" }
  | { type: "MOVE"; payload: { dx: number; dy: number } }
  | {
      type: "RESIZE";
      payload: {
        side:
          | "top"
          | "bottom"
          | "left"
          | "right"
          | "top-left"
          | "top-right"
          | "bottom-left"
          | "bottom-right";
        dx: number;
        dy: number;
      };
    }
  | {
      type: "INIT";
      payload: {
        title: string;
        program: WindowState["program"];
        id: string;
        loading?: boolean;
        size?: WindowState["size"];
        pos?: WindowState["pos"];
        icon?: string;
        status?: WindowState["status"];
      };
    }
  | { type: "SET_ICON"; payload: string }
  | { type: "UPDATE_PROGRAM"; payload: Partial<WindowState["program"]> }
  | { type: "SET_ERROR"; payload: string | undefined };

export const windowAtomFamily = atomFamily((id: string) => {
  return atomWithReducer(
    {
      status: "normal",
      pos: { x: 100, y: 100 },
      size: { width: 400, height: "auto" },
      title: "Welcome to danoh.com",
      program: {
        type: "welcome",
      },
      id,
      loading: false,
    },
    windowReducer
  );
});

export const MIN_WINDOW_SIZE = { width: 300, height: 100 };

function clampSize(size: WindowState["size"]): WindowState["size"] {
  return {
    width: clampWidth(size.width),
    height: size.height === "auto" ? "auto" : clampHeight(size.height),
  };
}

function clampWidth(width: number): number {
  return Math.max(width, MIN_WINDOW_SIZE.width);
}

function clampHeight(height: number): number {
  return Math.max(height, MIN_WINDOW_SIZE.height);
}

// A resize on an "auto"-height window should never reach here — the
// MATERIALIZE_HEIGHT dispatch at resize-start pins it to pixels first.
// Fall back to the minimum defensively rather than treating "auto" as 0.
function heightPx(height: number | "auto"): number {
  return height === "auto" ? MIN_WINDOW_SIZE.height : height;
}

// Keep at least this much of the title bar on-screen so the user can always
// grab it and drag the window back.
const MIN_TITLE_BAR_VISIBLE = 80;

function enforceInvariants(state: WindowState): WindowState {
  const windowWidth =
    typeof window !== "undefined" ? window.innerWidth : Infinity;
  const windowHeight =
    typeof window !== "undefined" ? window.innerHeight : Infinity;

  const minX = MIN_TITLE_BAR_VISIBLE - state.size.width;
  const maxX = windowWidth - MIN_TITLE_BAR_VISIBLE;

  return {
    ...state,
    pos: {
      x: Math.min(Math.max(state.pos.x, minX), maxX),
      y: Math.min(Math.max(state.pos.y, 0), windowHeight - 40),
    },
  };
}

function windowReducerInner(
  state: WindowState,
  action: WindowAction
): WindowState {
  switch (action.type) {
    case "TOGGLE_MAXIMIZE":
      return {
        ...state,
        status: state.status === "maximized" ? "normal" : "maximized",
      };
    case "TOGGLE_MINIMIZE":
      if (state.status === "minimized") {
        return { ...state, status: state.restoreStatus ?? "normal" };
      }
      return {
        ...state,
        status: "minimized",
        restoreStatus: state.status === "maximized" ? "maximized" : "normal",
      };
    case "MOVE":
      if (state.status === "maximized" || state.status === "minimized") {
        return state;
      }
      return {
        ...state,
        pos: {
          x: state.pos.x + action.payload.dx,
          y: state.pos.y + action.payload.dy,
        },
      };
    case "RESTORE":
      return { ...state, status: state.restoreStatus ?? "normal" };
    case "INIT":
      return { ...state, ...action.payload };
    case "RESIZE":
      const newState = handleResize(state, action);
      return {
        ...newState,
        size: clampSize(newState.size),
      };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "MATERIALIZE_HEIGHT":
      return state.size.height === "auto"
        ? { ...state, size: { ...state.size, height: action.payload } }
        : state;
    case "SET_ICON":
      return { ...state, icon: action.payload };
    case "UPDATE_PROGRAM":
      return {
        ...state,
        program: { ...state.program, ...action.payload } as any,
      };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      assertNever(action);
  }

  return state;
}

function windowReducer(state: WindowState, action: WindowAction): WindowState {
  return enforceInvariants(windowReducerInner(state, action));
}

// Resize by moving the dragged edge while pinning the opposite one.
// Size is clamped to the minimum here, and any position shift is derived
// from the *clamped* size change — so once a window hits its minimum,
// dragging further stops moving it instead of walking it across the desk.
function handleResize(state: WindowState, action: WindowAction) {
  if (action.type !== "RESIZE") {
    return state;
  }

  const { side, dx, dy } = action.payload;
  const curW = state.size.width;
  const curH = heightPx(state.size.height);

  const growsLeft = side === "left" || side === "top-left" || side === "bottom-left";
  const growsTop = side === "top" || side === "top-left" || side === "top-right";
  const changesWidth = side !== "top" && side !== "bottom";
  const changesHeight = side !== "left" && side !== "right";

  // A left/top edge moves toward the pointer; a right/bottom edge moves
  // with it — hence the sign flip on the "grows from the near edge" cases.
  const newWidth = changesWidth
    ? clampWidth(curW + (growsLeft ? -dx : dx))
    : state.size.width;
  const newHeight = changesHeight
    ? clampHeight(curH + (growsTop ? -dy : dy))
    : state.size.height;

  return {
    ...state,
    size: { width: newWidth, height: newHeight },
    pos: {
      // Pin the far edge: shift position by exactly the (clamped) size
      // change when the near edge is the one being dragged.
      x: growsLeft ? state.pos.x + (curW - newWidth) : state.pos.x,
      y: growsTop ? state.pos.y + (curH - heightPx(newHeight)) : state.pos.y,
    },
  };
}

export function getIframeID(id: string) {
  return `iframe-${id}`;
}

export async function reloadIframe(id: string) {
  const store = getDefaultStore();
  const window = store.get(windowAtomFamily(id));
  assert(window.program.type === "iframe", "Window is not an iframe");
  const program = await store.get(programAtomFamily(window.program.programID));
  assert(program, "Program not found");

  // Clearing the code flips Iframe back into generation mode and bumps
  // currentVersion, which remounts the (sandboxed, opaque-origin)
  // iframe and re-runs the streaming fetch. No direct contentWindow
  // access — that would throw cross-origin against the sandbox.
  store.set(programsAtom, {
    type: "UPDATE_PROGRAM",
    payload: { id: program.id, code: undefined },
  });
  store.set(windowAtomFamily(id), { type: "SET_LOADING", payload: true });
}

export function getIframe(id: string): HTMLIFrameElement | null {
  return document.getElementById(getIframeID(id)) as HTMLIFrameElement | null;
}
