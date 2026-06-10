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

  if (isCentering && size.height === "auto") {
    waitForElement(id).then((element) => {
      if (element) {
        // Auto-height windows are placed with a guessed height, then
        // re-centered here once the real height is known. Center within
        // the area ABOVE the taskbar — the old math used the full
        // viewport height, which let tall windows (e.g. the Run dialog
        // with its bring-your-own-key gate) spill under the taskbar on
        // short viewports. Then clamp so the whole window stays
        // on-screen; one taller than the usable area pins to the top so
        // its title bar stays reachable.
        const taskbarH = 40;
        const usableH = window.innerHeight - taskbarH;
        const elementHeight = element.offsetHeight;
        const centered = Math.floor(usableH / 2 - elementHeight / 2);
        const newY = Math.max(0, Math.min(centered, usableH - elementHeight));
        getDefaultStore().set(windowAtomFamily(id), {
          type: "MOVE",
          payload: { dx: 0, dy: newY - pos.y },
        });
      }
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
