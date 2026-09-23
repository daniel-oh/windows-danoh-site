import { getDefaultStore } from "jotai";
import { focusedWindowAtom } from "../state/focusedWindow";
import { createWindow } from "./createWindow";
import { openProgram, RUN_SIZE } from "./programs";
import { isMobile } from "./isMobile";
import { waitForElement } from "./waitForElement";
import { seedDemoProgram } from "./demoPrograms";

let initialized = false;

const MAX_SHARE_PROMPT_LENGTH = 500;

function readShareablePrompt(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("run");
  if (!raw) return null;
  // Strip the param from the URL so a refresh doesn't re-run the prompt.
  params.delete("run");
  const query = params.toString();
  const newUrl =
    window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
  window.history.replaceState(null, "", newUrl);
  const trimmed = raw.trim().slice(0, MAX_SHARE_PROMPT_LENGTH);
  return trimmed || null;
}

export function initState() {
  if (initialized) return;
  initialized = true;

  // Fire-and-forget: drops Snake.exe on the desktop the first time a
  // browser visits, so the "AI builds apps" promise has a working
  // exhibit even for visitors without an access code.
  void seedDemoProgram();

  const sharedPrompt = readShareablePrompt();

  if (sharedPrompt) {
    // Shareable link flow: land directly on Run with the prompt filled in,
    // waiting for the visitor to press Open (see Run.tsx). Welcome opens
    // behind it so the visitor has context about where they are.
    openProgram("welcome");
    createWindow({
      title: "Run",
      program: { type: "run", initialPrompt: sharedPrompt },
      size: RUN_SIZE,
    });
    return;
  }

  const id = openProgram("welcome");
  if (!isMobile()) {
    waitForElement(id).then((el) => {
      if (el) {
        const welcomeRect = el.getBoundingClientRect();
        const runLeft = welcomeRect.left - 100; // Overlap by 50 pixels
        const runTop = welcomeRect.top + 200; // Offset slightly from the top of Welcome

        createWindow({
          title: "Run",
          program: { type: "run" },
          size: RUN_SIZE,
          pos: { x: runLeft, y: runTop },
        });
        // Run is an offer, not a greeting. createWindow focuses whatever it
        // makes, so hand focus back: a first-time visitor should be reading
        // Welcome, with the access-code dialog waiting behind it. The DOM
        // focus follows the atom, or the keyboard would still be inside a
        // window nobody asked for.
        getDefaultStore().set(focusedWindowAtom, id);
        el.focus({ preventScroll: true });
      }
    });
  }
}
