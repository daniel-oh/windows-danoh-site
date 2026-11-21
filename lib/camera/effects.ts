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
      return glass(data, width, height);
  }
}

/** The size each effect draws the live frame at. Glass is smooth, so it
 * needs more pixels than the 1998 effects, which are meant to be blocky. */
export function frameSize(effect: Effect): { width: number; height: number } {
  return effect === "glass" ? { width: GLASS.width, height: (GLASS.width * 3) / 4 } : { width: 160, height: 120 };
}

// ---------------------------------------------------------------------------
// Glass: a bumpy pane of glass in front of the lens, after React Bits'
// ReflectiveCard (github.com/DavidHDev/react-bits, MIT + Commons Clause).
//
// It used to be an SVG filter on the preview canvas. A snapshot copies the
// canvas pixels, which never had the filter in them, so every Glass picture
// saved without the glass. It is now done in pixels like the other effects,
// with the same recipe the filter had: feTurbulence noise bends the picture
// (feDisplacementMap) and lights it like a bumpy surface (feSpecularLighting,
// screen blended on top).
//
// Lengths are in pixels of a 360px wide frame, the width the Camera window
// shows it at, so the glass looks the same at any resolution: the live
// preview draws it at 360x270, a snap at twice that.
const GLASS = {
  width: 360,
  baseFrequency: [0.012, 0.02],
  octaves: 2,
  seed: 7,
  scale: 14,
  surfaceScale: 3,
  specularConstant: 0.9,
  specularExponent: 22,
  azimuth: 235,
  elevation: 55,
};

// feTurbulence, ported from the reference code in the Filter Effects spec
// (www.w3.org/TR/filter-effects-1/#feTurbulenceElement), so the noise is the
// one the browser's filter drew. Stitching is left out: the glass never tiles.
const BSIZE = 0x100;
const BM = 0xff;
const PERLIN_N = 0x1000;
const RAND_M = 2147483647;
const RAND_A = 16807;
const RAND_Q = 127773;
const RAND_R = 2836;

export function makeTurbulence(seed: number) {
  const lattice = new Int32Array(BSIZE + BSIZE + 2);
  const gradient = [0, 1, 2, 3].map(() => new Float64Array((BSIZE + BSIZE + 2) * 2));
  let s = Math.round(seed);
  if (s <= 0) s = -(s % (RAND_M - 1)) + 1;
  if (s > RAND_M - 1) s = RAND_M - 1;
  const random = () => {
    let r = RAND_A * (s % RAND_Q) - RAND_R * Math.floor(s / RAND_Q);
    if (r <= 0) r += RAND_M;
    s = r;
    return r;
  };
  let i = 0;
  for (let k = 0; k < 4; k++) {
    const g = gradient[k];
    for (i = 0; i < BSIZE; i++) {
      lattice[i] = i;
      g[i * 2] = ((random() % (BSIZE + BSIZE)) - BSIZE) / BSIZE;
      g[i * 2 + 1] = ((random() % (BSIZE + BSIZE)) - BSIZE) / BSIZE;
      const n = Math.hypot(g[i * 2], g[i * 2 + 1]);
      if (n > 0) {
        g[i * 2] /= n;
        g[i * 2 + 1] /= n;
      }
    }
  }
  while (--i) {
    const k = lattice[i];
    const j = random() % BSIZE;
    lattice[i] = lattice[j];
    lattice[j] = k;
  }
  for (i = 0; i < BSIZE + 2; i++) {
    lattice[BSIZE + i] = lattice[i];
    for (let k = 0; k < 4; k++) {
      gradient[k][(BSIZE + i) * 2] = gradient[k][i * 2];
      gradient[k][(BSIZE + i) * 2 + 1] = gradient[k][i * 2 + 1];
    }
  }

  const sCurve = (t: number) => t * t * (3 - 2 * t);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);
  const noise2 = (channel: number, x: number, y: number) => {
    const g = gradient[channel];
    const tx = x + PERLIN_N;
    const bx0 = Math.trunc(tx) & BM;
    const bx1 = (bx0 + 1) & BM;
    const rx0 = tx - Math.trunc(tx);
    const rx1 = rx0 - 1;
    const ty = y + PERLIN_N;
    const by0 = Math.trunc(ty) & BM;
    const by1 = (by0 + 1) & BM;
    const ry0 = ty - Math.trunc(ty);
    const ry1 = ry0 - 1;
    const i0 = lattice[bx0];
    const j0 = lattice[bx1];
    const b00 = lattice[i0 + by0];
    const b10 = lattice[j0 + by0];
    const b01 = lattice[i0 + by1];
    const b11 = lattice[j0 + by1];
    const sx = sCurve(rx0);
    const sy = sCurve(ry0);
    const a = lerp(sx, rx0 * g[b00 * 2] + ry0 * g[b00 * 2 + 1], rx1 * g[b10 * 2] + ry0 * g[b10 * 2 + 1]);
    const b = lerp(sx, rx0 * g[b01 * 2] + ry1 * g[b01 * 2 + 1], rx1 * g[b11 * 2] + ry1 * g[b11 * 2 + 1]);
    return lerp(sy, a, b);
  };

  /** type="fractalNoise" for one channel (0..3 = RGBA), as a 0..1 value. */
  return (channel: number, px: number, py: number, fx: number, fy: number, octaves: number) => {
    let x = px * fx;
    let y = py * fy;
    let sum = 0;
    let ratio = 1;
    for (let o = 0; o < octaves; o++) {
      sum += noise2(channel, x, y) / ratio;
      x *= 2;
      y *= 2;
      ratio *= 2;
    }
    const v = (sum + 1) / 2;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  };
}

type GlassMap = {
  /** For each output pixel, the source pixel it shows, or -1 for black. */
  from: Int32Array;
  /** The specular highlight on each pixel, 0..255. */
  shine: Uint8ClampedArray;
  /** Reused copy of the frame, so the live preview allocates nothing. */
  scratch: Uint8ClampedArray;
};
const glassMaps = new Map<string, GlassMap>();

// The pane does not move, so its bends and highlights are worked out once
// per frame size and every frame after that is a lookup and a blend.
export function glassMap(width: number, height: number): GlassMap {
  const key = `${width}x${height}`;
  const hit = glassMaps.get(key);
  if (hit) return hit;
  const u = width / GLASS.width;
  const [fx, fy] = GLASS.baseFrequency;
  const turbulence = makeTurbulence(GLASS.seed);
  const n = width * height;
  const from = new Int32Array(n);
  const height01 = new Float32Array(n);
  const scale = GLASS.scale * u;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      // Pixel centres: within 1/255 of what Chrome, Safari and Firefox draw.
      const cx = (x + 0.5) / u;
      const cy = (y + 0.5) / u;
      const dx = turbulence(0, cx, cy, fx, fy, GLASS.octaves);
      const dy = turbulence(1, cx, cy, fx, fy, GLASS.octaves);
      height01[p] = turbulence(3, cx, cy, fx, fy, GLASS.octaves);
      const sx = Math.round(x + scale * (dx - 0.5));
      const sy = Math.round(y + scale * (dy - 0.5));
      from[p] = sx >= 0 && sx < width && sy >= 0 && sy < height ? sy * width + sx : -1;
    }
  }

  // Distant light, and the half vector to an eye straight in front.
  const az = (GLASS.azimuth * Math.PI) / 180;
  const el = (GLASS.elevation * Math.PI) / 180;
  let hx = Math.cos(az) * Math.cos(el);
  let hy = Math.sin(az) * Math.cos(el);
  let hz = Math.sin(el) + 1;
  const hn = Math.hypot(hx, hy, hz);
  hx /= hn;
  hy /= hn;
  hz /= hn;
  // The spec's Sobel normal, one frame unit apart: step pixels here, with
  // the slope scaled back to frame units when the frame is drawn larger.
  const step = Math.max(1, Math.round(u));
  const k = (GLASS.surfaceScale * u) / step / 4;
  const shine = new Uint8ClampedArray(n);
  const at = (x: number, y: number) =>
    height01[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (from[p] < 0) continue;
      const l = x - step;
      const r = x + step;
      const t = y - step;
      const b = y + step;
      const nx = -k * (at(r, t) + 2 * at(r, y) + at(r, b) - at(l, t) - 2 * at(l, y) - at(l, b));
      const ny = -k * (at(l, b) + 2 * at(x, b) + at(r, b) - at(l, t) - 2 * at(x, t) - at(r, t));
      const nh = (nx * hx + ny * hy + hz) / Math.hypot(nx, ny, 1);
      if (nh > 0) shine[p] = GLASS.specularConstant * Math.pow(nh, GLASS.specularExponent) * 255;
    }
  }
  const map = { from, shine, scratch: new Uint8ClampedArray(n * 4) };
  glassMaps.set(key, map);
  return map;
}

/** Bend the frame through the pane and screen its highlights on top.
 * Pixels the pane bends in from outside the frame are black, as they were
 * over the viewfinder's black panel. */
export function glass(data: Uint8ClampedArray, width: number, height: number): void {
  const { from, shine, scratch } = glassMap(width, height);
  scratch.set(data);
  for (let p = 0; p < from.length; p++) {
    const i = p * 4;
    const j = from[p] * 4;
    const s = shine[p];
    const r = j < 0 ? 0 : scratch[j];
    const g = j < 0 ? 0 : scratch[j + 1];
    const b = j < 0 ? 0 : scratch[j + 2];
    data[i] = r + s - (r * s) / 255;
    data[i + 1] = g + s - (g * s) / 255;
    data[i + 2] = b + s - (b * s) / 255;
    data[i + 3] = 255;
  }
}

export function snapFilename(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `snap-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
}
