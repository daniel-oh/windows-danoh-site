import {
  PALETTE,
  nearestPaletteIndex,
  oneBit,
  phosphor,
  pixelate,
  sixteenColours,
  snapFilename,
} from "../effects";

const frame = (w: number, h: number, fill: (x: number, y: number) => [number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  return data;
};
const inPalette = (data: Uint8ClampedArray) => {
  for (let i = 0; i < data.length; i += 4) {
    if (!PALETTE.some(([r, g, b]) => r === data[i] && g === data[i + 1] && b === data[i + 2])) return false;
  }
  return true;
};

describe("camera effects", () => {
  test("nearest palette index picks exact matches and neighbours", () => {
    expect(PALETTE[nearestPaletteIndex(255, 0, 0)]).toEqual([255, 0, 0]);
    expect(PALETTE[nearestPaletteIndex(200, 200, 200)]).toEqual([192, 192, 192]);
    expect(PALETTE[nearestPaletteIndex(10, 10, 10)]).toEqual([0, 0, 0]);
  });

  test("sixteenColours only emits palette colours and dithers mid grey", () => {
    const d = frame(8, 8, () => [128, 128, 128]);
    sixteenColours(d, 8, 8);
    expect(inPalette(d)).toBe(true);
    const distinct = new Set<string>();
    for (let i = 0; i < d.length; i += 4) distinct.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    // A flat mid grey becomes a weave of at least two palette greys.
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });

  test("oneBit is pure black and white and keeps the average tone", () => {
    const d = frame(16, 16, () => [128, 128, 128]);
    oneBit(d, 16, 16);
    let white = 0;
    for (let i = 0; i < d.length; i += 4) {
      expect([0, 255]).toContain(d[i]);
      expect(d[i]).toBe(d[i + 1]);
      expect(d[i]).toBe(d[i + 2]);
      if (d[i] === 255) white++;
    }
    // Error diffusion of 50% grey lands near half the pixels white.
    expect(white / 256).toBeGreaterThan(0.35);
    expect(white / 256).toBeLessThan(0.65);
  });

  test("phosphor is green with darker odd rows", () => {
    const d = frame(4, 2, () => [200, 200, 200]);
    phosphor(d, 4, 2);
    expect(d[1]).toBeGreaterThan(d[0]);
    expect(d[1]).toBeGreaterThan(d[2]);
    const row0 = d[1];
    const row1 = d[4 * 4 + 1];
    expect(row1).toBeLessThan(row0);
  });

  test("pixelate averages each block", () => {
    const d = frame(4, 4, (x) => (x < 2 ? [0, 0, 0] : [200, 100, 0]));
    pixelate(d, 4, 4, 4);
    for (let i = 0; i < d.length; i += 4) {
      expect([d[i], d[i + 1], d[i + 2]]).toEqual([100, 50, 0]);
    }
  });

  test("snapFilename is zero padded and sortable", () => {
    expect(snapFilename(new Date(2026, 8, 3, 7, 5))).toBe("snap-2026-09-03-0705.png");
  });
});
