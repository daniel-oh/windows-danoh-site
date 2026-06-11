"use client";

import { getDefaultStore } from "jotai";
import { focusedWindowAtom } from "../state/focusedWindow";
import { windowsListAtom } from "@/state/windowsList";
import { MIN_WINDOW_SIZE, WindowState, windowAtomFamily } from "@/state/window";
import { isMobile } from "./isMobile";
import { waitForElement } from "./waitForElement";

export function createWindow({
  title,
  program,
  loading = false,
  size = { ...MIN_WINDOW_SIZE, height: "auto" },
  pos,
  icon,
}: {
  title: string;
  program: WindowState["program"];
  loading?: boolean;
  size?: WindowState["size"];
  pos?: WindowState["pos"];
  icon?: string;
}): string {
  const id = generateRandomId();
  const mobile = isMobile();

  // Clamp size to viewport on mobile (with padding)
  if (mobile && program.type !== "iframe") {
    const maxW = window.innerWidth - 16;
    const maxH = window.innerHeight - 80;
    size = {
      width: Math.min(size.width, maxW),
      height: size.height === "auto" ? "auto" : Math.min(size.height, maxH),
    };
  }

  // CSS enforces MIN_WINDOW_SIZE anyway; clamping the state too keeps
  // the first resize drag from traversing a dead zone where the stored
  // width crawls up to what's already rendered.
  size = {
    width: Math.max(size.width, MIN_WINDOW_SIZE.width),
    height:
      size.height === "auto"
        ? "auto"
        : Math.max(size.height, MIN_WINDOW_SIZE.height),
  };

  const isCentering = !pos;
  if (!pos) {
    // Cascade new windows so two Start-menu opens of the same program
    // don't land at identical coordinates and disappear on top of each other.
    const openCount = getDefaultStore().get(windowsListAtom).length;
    const cascadeOffset = (openCount % 10) * 24;
    // Center within the area above the taskbar — centering against the
    // full viewport let restored windows underlap it.
    const taskbarH = 40;
    const usableH = window.innerHeight - taskbarH;
    const winH = size.height === "auto" ? MIN_WINDOW_SIZE.height : size.height;
    const centerX = Math.floor(window.innerWidth / 2 - size.width / 2);
    const centerY = Math.floor(usableH / 2 - winH / 2);
    pos = {
      // Clamp the right edge on-screen too (cascade could push a wide
      // window off the right), not just x >= 0.
      x: Math.min(
        Math.max(0, centerX + cascadeOffset),
        Math.max(0, window.innerWidth - size.width)
      ),
      y: Math.min(
        Math.max(0, centerY + cascadeOffset),
        Math.max(0, usableH - Math.min(winH, usableH))
      ),
    };
  }
  // Force-maximize gates on WIDTH only: pointer-coarse alone (iPads in
  // landscape) handles the full desktop metaphor fine and shouldn't be
  // locked to one window. Dialog-type programs stay small everywhere —
  // a full-screen gray void with a form in the top corner is the worst
  // version of an alert.
  const DIALOG_TYPES: ReadonlySet<string> = new Set(["alert", "run"]);
  const narrow =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches;
  getDefaultStore().set(windowAtomFamily(id), {
    type: "INIT",
    payload: {
      title,
      program,
      id,
      loading,
      size,
      pos,
      icon,
      status:
        narrow && !DIALOG_TYPES.has(program.type) ? "maximized" : "normal",
    },
  });
  getDefaultStore().set(windowsListAtom, { type: "ADD", payload: id });
  getDefaultStore().set(focusedWindowAtom, id);

  if (size.height === "auto") {
    waitForElement(id).then((element) => {
      if (!element) return;
      const taskbarH = 40;

      // Auto-height windows are placed with a guessed height, then
      // corrected once the real height is known. Read the LIVE position
      // each pass (not the initial guess) so repeated passes compose,
      // and work within the area ABOVE the taskbar — using the full
      // viewport height let tall windows spill under it.
      const clamp = () => {
        const cur = getDefaultStore().get(windowAtomFamily(id)).pos;
        const usableH = window.innerHeight - taskbarH;
        const h = element.offsetHeight;
        const w = element.offsetWidth;
        let newX = cur.x;
        let newY = cur.y;
        if (isCentering) {
          // Re-center vertically, then clamp so the whole window stays
          // on-screen; one taller than usable pins to the top so its
          // title bar stays reachable.
          const centered = Math.floor(usableH / 2 - h / 2);
          newY = Math.max(0, Math.min(centered, usableH - h));
        } else {
          // Explicit position (e.g. the Run dialog dropped below
          // Welcome): honor it, but clamp both axes so it can't spill
          // its bottom under the taskbar or its sides off-screen. An
          // explicit pos used to skip clamping entirely.
          newY = Math.max(0, Math.min(cur.y, usableH - h));
          newX = Math.max(0, Math.min(cur.x, window.innerWidth - w));
        }
        if (newX !== cur.x || newY !== cur.y) {
          getDefaultStore().set(windowAtomFamily(id), {
            type: "MOVE",
            payload: { dx: newX - cur.x, dy: newY - cur.y },
          });
        }
      };

      clamp();
      // Gated dialogs (Run, Help) grow a frame or two after first paint
      // as fonts and sub-forms settle, so a single measure clamps against
      // a too-short height and the final layout still overflows. Re-clamp
      // on real size changes, briefly — then disconnect so the user can
      // freely drag the window off-edge afterward. A move doesn't change
      // size, so this can't loop.
      const ro = new ResizeObserver(clamp);
      ro.observe(element);
      setTimeout(() => ro.disconnect(), 2500);
    });
  }
  return id;
}

function generateRandomId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
