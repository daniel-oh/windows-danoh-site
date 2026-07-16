// Persisted startup-sound opt-out. Lives in localStorage (not the
// sessionStorage-backed settings atom) for the same reason as the
// analytics flag: the sound plays once per session, so a per-tab
// preference would silently re-arm it on every visit — the opposite
// of what someone who turned it off asked for (WCAG 1.4.2).
//
// prefers-reduced-motion also suppresses the sound (see OS.tsx); this
// flag is the in-UI control for everyone else.

const KEY = "danoh_sound_off";

export function isStartupSoundOff(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setStartupSoundOff(off: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (off) window.localStorage.setItem(KEY, "true");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* swallow storage errors — private-mode / quota */
  }
}
