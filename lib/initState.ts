import { WIDTH } from "@/components/programs/Welcome";
import { createWindow } from "./createWindow";
import { isMobile } from "./isMobile";
import { waitForElement } from "./waitForElement";

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

  const sharedPrompt = readShareablePrompt();

  if (sharedPrompt) {
    // Shareable link flow: land directly on Run with the prompt pre-filled
    // and auto-submitted. We still open Welcome behind it so the visitor has
    // context about where they are after the generated program appears.
    createWindow({
      title: "Welcome to danoh.com",
      program: { type: "welcome" },
      size: { width: WIDTH, height: "auto" },
    });
    createWindow({
      title: "Run",
      program: { type: "run", initialPrompt: sharedPrompt },
      size: { width: 360, height: "auto" },
    });
    return;
  }

  const id = createWindow({
    title: "Welcome to danoh.com",
    program: { type: "welcome" },

    size: { width: WIDTH, height: "auto" },
  });
  if (!isMobile()) {
    waitForElement(id).then((el) => {
      if (el) {
        const welcomeRect = el.getBoundingClientRect();
        const runWidth = 200;
        const runLeft = welcomeRect.left - 100; // Overlap by 50 pixels
        const runTop = welcomeRect.top + 200; // Offset slightly from the top of Welcome

        createWindow({
          title: "Run",
          program: { type: "run" },
          size: { width: runWidth, height: "auto" },
          pos: { x: runLeft, y: runTop },
        });
      }
    });
  }
}
