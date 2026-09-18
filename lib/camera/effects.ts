// Pixel effects for the Camera program. Pure functions over ImageData so
// they are testable without a browser: each takes the frame's RGBA bytes
// and writes the result back in place.

export type Effect = "colours" | "mono" | "phosphor" | "pixelate" | "glass";

export const EFFECTS: { id: Effect; label: string }[] = [
  { id: "colours", label: "16 colours" },
  { id: "mono", label: "1-bit" },
  { id: "phosphor", label: "Phosphor" },
  { id: "pixelate", label: "Pixelate" },
  { id: "glass", label: "Glass" },
];

// The Windows 98 VGA palette: the sixteen colours every 256-colour
// display promised to have.
export const PALETTE: [number, number, number][] = [
  [0, 0, 0],
  [128, 0, 0],
  [0, 128, 0],
  [128, 128, 0],
  [0, 0, 128],
  [128, 0, 128],
  [0, 128, 128],
  [192, 192, 192],
  [128, 128, 128],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [0, 0, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];

// 4x4 Bayer matrix, normalised to -0.5..0.5 so the threshold is centred.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16 - 0.5));

export function nearestPaletteIndex(r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const [pr, pg, pb] = PALETTE[i];
    const d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Ordered dither to the 16-colour palette: the 1998 webcam look. */
export function sixteenColours(data: Uint8ClampedArray, width: number, height: number): void {
  // The spread is how far a pixel is pushed before snapping: wide enough
  // that mid tones become a visible weave of two palette colours.
  const spread = 96;
  for (let y = 0; y < height; y++) {
    const row = BAYER[y & 3];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = row[x & 3] * spread;
      const [r, g, b] = PALETTE[nearestPaletteIndex(clamp(data[i] + t), clamp(data[i + 1] + t), clamp(data[i + 2] + t))];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  }
}

/** Floyd-Steinberg to pure black and white. */
export function oneBit(data: Uint8ClampedArray, width: number, height: number): void {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = lum[i];
      const nw = old < 128 ? 0 : 255;
      const err = old - nw;
      lum[i] = nw;
      if (x + 1 < width) lum[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) lum[i + width - 1] += (err * 3) / 16;
        lum[i + width] += (err * 5) / 16;
        if (x + 1 < width) lum[i + width + 1] += (err * 1) / 16;
      }
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = nw;
    }
  }
}

/** Green monochrome with scanlines: the terminal, but it can see you. */
export function phosphor(data: Uint8ClampedArray, width: number, height: number): void {
  for (let y = 0; y < height; y++) {
    const scan = y & 1 ? 0.55 : 1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * scan;
      data[i] = clamp(l * 0.2);
      data[i + 1] = clamp(l * 1.05 + 10);
      data[i + 2] = clamp(l * 0.25);
    }
  }
}

/** Average blocks of `size` pixels. The caller decides the block size. */
export function pixelate(data: Uint8ClampedArray, width: number, height: number, size: number): void {
  for (let by = 0; by < height; by += size) {
    for (let bx = 0; bx < width; bx += size) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = by; y < Math.min(by + size, height); y++) {
        for (let x = bx; x < Math.min(bx + size, width); x++) {
          const i = (y * width + x) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
      }
      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);
      for (let y = by; y < Math.min(by + size, height); y++) {
        for (let x = bx; x < Math.min(bx + size, width); x++) {
          const i = (y * width + x) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
      }
    }
  }
}

export function applyEffect(effect: Effect, data: Uint8ClampedArray, width: number, height: number): void {
  switch (effect) {
    case "colours":
      return sixteenColours(data, width, height);
    case "mono":
      return oneBit(data, width, height);
    case "phosphor":
      return phosphor(data, width, height);
    case "pixelate":
      return pixelate(data, width, height, 8);
    case "glass":
      // Left as the live frame; the glass is an SVG filter on the canvas.
      return;
  }
}

export function snapFilename(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `snap-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
}
