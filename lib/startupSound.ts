// Persisted startup-sound preference. OFF by default: an unexpected
// chime on the first click is the kind of surprise that makes people
// leave a tab, and reduced-motion users never wanted it (WCAG 1.4.2).
// Anyone who likes the theatrics can flip it on in Settings.
//
// Lives in localStorage (not the sessionStorage-backed settings atom)
// so the choice survives across visits instead of resetting per tab.

const KEY = "danoh_sound_on";
// Pre-2026-08 the flag was inverted ("danoh_sound_off"); drop it so it
// can't confuse a future reader of localStorage.
const LEGACY_KEY = "danoh_sound_off";

export function isStartupSoundOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setStartupSoundOn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(KEY, "true");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* swallow storage errors — private-mode / quota */
  }
}
