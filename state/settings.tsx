import { atomWithStorage, createJSONStorage } from "jotai/utils";

export type Settings = {
  apiKey: string | null;
  model?: "cheap" | "best";
  /** CRT monitor mode: scanlines + vignette overlay on the desktop. */
  crt?: boolean;
};

// Persist in sessionStorage (cleared when the tab closes) rather than
// localStorage. The Anthropic API key is sensitive — this limits exposure
// if a future XSS bug landed in the app. Visitors who accept the
// trade-off can tick "Remember on this device" (Run gate or Settings),
// which mirrors JUST the key into localStorage; the session copy stays
// the working source of truth.

const REMEMBER_FLAG = "danoh_remember_key";
const REMEMBERED_KEY = "danoh_api_key";

export function isApiKeyRemembered(): boolean {
  try {
    return localStorage.getItem(REMEMBER_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Flip the remember flag and sync the mirrored copy to match. */
export function setApiKeyRemembered(
  remember: boolean,
  currentKey: string | null
) {
  try {
    if (remember) {
      localStorage.setItem(REMEMBER_FLAG, "1");
      if (currentKey) localStorage.setItem(REMEMBERED_KEY, currentKey);
    } else {
      localStorage.removeItem(REMEMBER_FLAG);
      localStorage.removeItem(REMEMBERED_KEY);
    }
  } catch {
    /* storage unavailable — the toggle is best-effort */
  }
}

// jotai only try/catches its DEFAULT storage getter; a custom one runs
// bare. Safari with "Block all cookies" throws SecurityError on the
// sessionStorage accessor itself, which would take the desktop down at
// first render. Fall back to in-memory (undefined) instead.
const sessionStore = createJSONStorage<Settings>(() => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : undefined!;
  } catch {
    return undefined!;
  }
});

// Read-through wrapper: a fresh tab has empty sessionStorage, so reads
// hydrate the key from the localStorage mirror when the visitor opted
// in; writes keep the mirror in sync (including clearing it when the
// key is cleared) for as long as the flag is on.
const settingsStorage: typeof sessionStore = {
  ...sessionStore,
  getItem: (key, initialValue) => {
    const value = sessionStore.getItem(key, initialValue);
    try {
      if (!value.apiKey && isApiKeyRemembered()) {
        const remembered = localStorage.getItem(REMEMBERED_KEY);
        if (remembered) return { ...value, apiKey: remembered };
      }
    } catch {
      /* fall through to the session value */
    }
    return value;
  },
  setItem: (key, value) => {
    sessionStore.setItem(key, value);
    try {
      if (isApiKeyRemembered()) {
        if (value.apiKey) localStorage.setItem(REMEMBERED_KEY, value.apiKey);
        else localStorage.removeItem(REMEMBERED_KEY);
      }
    } catch {
      /* the mirror is best-effort */
    }
  },
};

export const settingsAtom = atomWithStorage<Settings>(
  "settings",
  { apiKey: null, model: "best" },
  settingsStorage
);
