import { atomWithStorage, createJSONStorage } from "jotai/utils";

export type Settings = {
  apiKey: string | null;
  model?: "cheap" | "best";
};

// Persist in sessionStorage (cleared when the tab closes) rather than
// localStorage. The Anthropic API key is sensitive — this limits exposure
// if a future XSS bug landed in the app.
const settingsStorage = createJSONStorage<Settings>(() =>
  typeof window !== "undefined" ? window.sessionStorage : undefined!
);

export const settingsAtom = atomWithStorage<Settings>(
  "settings",
  { apiKey: null, model: "best" },
  settingsStorage
);
