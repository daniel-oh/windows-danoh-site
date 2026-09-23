// Pure helpers for the pad grid: the keyboard map, how hard a press counts as,
// and where a hit lands in the bar. Kept out of the component so they can be
// tested without an AudioContext.

export const PADS = 16;
export const STEPS = 16;

/// The grid reads bottom-left to top-right, pad 1 in the bottom-left corner,
/// which is how every hardware box and every software sampler lays it out.
/// The keyboard follows the same shape on a QWERTY keyboard.
export const KEY_ROWS = ["zxcv", "asdf", "qwer", "1234"] as const;

/** Lower-case key to pad index, or -1. */
export function padForKey(key: string): number {
  const k = key.toLowerCase();
  for (let row = 0; row < KEY_ROWS.length; row++) {
    const col = KEY_ROWS[row].indexOf(k);
    if (col >= 0) return row * 4 + col;
  }
  return -1;
}

/** Where the key physically is, not what it types: on AZERTY or Dvorak the
 * letters move but the grid should not. Falls back to the character for
 * keys that report no code. */
export function padForKeyEvent(e: { code?: string; key: string }): number {
  const m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(e.code ?? "");
  if (m) return padForKey((m[1] ?? m[2]).toLowerCase());
  return e.code ? -1 : padForKey(e.key);
}

/** The key that plays a pad, for the labels in the corner of each pad. */
export function keyForPad(pad: number): string {
  const row = Math.floor(pad / 4);
  const col = pad % 4;
  return KEY_ROWS[row]?.[col]?.toUpperCase() ?? "";
}

/** Grid position: row 0 is the top row on screen (pads 13-16). */
export function padAtGrid(rowFromTop: number, col: number): number {
  return (3 - rowFromTop) * 4 + col;
}

/**
 * Velocity from where the pad was pressed: soft at the top, hard at the
 * bottom, the way a real pad answers a glancing hit versus a full one. Clamped
 * to a floor so the top edge is never silent, which would read as a bug.
 */
export function velocityFromPoint(offsetY: number, height: number): number {
  if (!(height > 0)) return 1;
  const t = Math.max(0, Math.min(1, offsetY / height));
  return Math.round((0.45 + 0.55 * t) * 100) / 100;
}

/** Keyboard and mouse hits have no position, so they land in the middle. */
export const DEFAULT_VELOCITY = 0.85;

/**
 * Which step a hit belongs to. `progress` is how far the bar has run, in
 * steps, so 3.6 means most of the way through step 3. Quantising rounds to
 * the nearest step and wraps, because a hit just before the downbeat belongs
 * to the downbeat, not to the end of the bar.
 */
export function stepForHit(progress: number, quantize: boolean): number {
  const raw = quantize ? Math.round(progress) : Math.floor(progress);
  return ((raw % STEPS) + STEPS) % STEPS;
}

/** Frames in one 16 step bar. */
export function loopFrames(bpm: number, sampleRate: number): number {
  return Math.round((60 / bpm / 4) * STEPS * sampleRate);
}

/** A pad's length for a sentence: whole seconds when it is whole, else one
 * decimal (6 at 48 kHz, 6.5 at 44.1 kHz, 3 at 96 kHz). */
export function secondsLabel(seconds: number): string {
  const tenths = Math.round(seconds * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
}
