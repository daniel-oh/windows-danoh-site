// Volume, kept out of the component so the curve and the remembering can be
// tested without a browser.

const KEY = "danoh_sampler_volume";
const MUTED_KEY = "danoh_sampler_muted";

/** Where the slider starts for someone who has never touched it. */
export const DEFAULT_LEVEL = 80;

/**
 * Slider position (0 to 100) to gain. Squared, because loudness is not
 * linear: a linear slider spends its top half doing almost nothing and its
 * bottom half going silent. Squared puts the useful range under your thumb,
 * with 50 landing at about a quarter of full scale.
 */
export function gainFor(level: number, muted = false): number {
  if (muted) return 0;
  const clamped = Math.min(100, Math.max(0, level));
  return Math.round((clamped / 100) ** 2 * 1000) / 1000;
}

/** What a screen reader should hear, rather than a bare number. */
export function levelLabel(level: number, muted: boolean): string {
  if (muted) return "Muted";
  return `Volume ${Math.round(level)} percent`;
}

/** Remembered across visits, like the startup sound setting. Storage can
 * throw (private windows, blocked site data), so every access is guarded. */
export function readVolume(): { level: number; muted: boolean } {
  if (typeof window === "undefined") return { level: DEFAULT_LEVEL, muted: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    const level = raw === null ? DEFAULT_LEVEL : Math.min(100, Math.max(0, Number(raw)));
    return {
      level: Number.isFinite(level) ? level : DEFAULT_LEVEL,
      muted: window.localStorage.getItem(MUTED_KEY) === "1",
    };
  } catch {
    return { level: DEFAULT_LEVEL, muted: false };
  }
}

export function writeVolume(level: number, muted: boolean) {
  try {
    window.localStorage.setItem(KEY, String(Math.round(level)));
    if (muted) window.localStorage.setItem(MUTED_KEY, "1");
    else window.localStorage.removeItem(MUTED_KEY);
  } catch {
    // Not being able to remember the volume is not worth an error.
  }
}
