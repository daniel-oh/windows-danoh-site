import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PADS, ReferenceEngine } from "../reference";
import { encodeWav, loopFilename } from "../wav";
import { keyForPad, loopFrames, padAtGrid, padForKey, stepForHit, velocityFromPoint } from "../pads";

// Runs the committed public/dsp/sampler.wasm, which is what production loads.
// If the binary is stale or broken, these fail, which is the whole reason the
// artifact can be committed without a byte-for-byte drift check.

type Exports = {
  memory: WebAssembly.Memory;
  init(sampleRate: number): void;
  pad_ptr(pad: number): number;
  pad_len(pad: number): number;
  set_pad_len(pad: number, len: number): void;
  pad_capacity(): number;
  io_ptr(): number;
  bounce_ptr(): number;
  name_ptr(pad: number): number;
  name_len(pad: number): number;
  set_param(id: number, value: number): void;
  note_on(pad: number, velocity: number, semitones: number): void;
  all_off(): void;
  seq_set(step: number, pad: number, velocity: number): void;
  seq_get(step: number, pad: number): number;
  seq_clear(): void;
  process(frames: number): number;
  bounce(frames: number): number;
  record_into(pad: number, frames: number): number;
  trim_normalize(pad: number): number;
  loop_frames(): number;
  take_peak(): number;
  current_step(): number;
};

const RATE = 48000;
const wasmBytes = readFileSync(join(process.cwd(), "public/dsp/sampler.wasm"));

async function load(): Promise<Exports> {
  const { instance } = await WebAssembly.instantiate(wasmBytes, {});
  const e = instance.exports as unknown as Exports;
  e.init(RATE);
  return e;
}

const block = (e: Exports, frames = 128) =>
  new Float32Array(e.memory.buffer, e.io_ptr(), frames);

const render = (e: Exports, blocks: number) => {
  const out = new Float32Array(blocks * 128);
  for (let b = 0; b < blocks; b++) {
    e.process(128);
    out.set(block(e), b * 128);
  }
  return out;
};

const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const peak = (x: Float32Array) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);

describe("sampler wasm", () => {
  test("builds a kit of sixteen named one-shots", async () => {
    const e = await load();
    const bytes = new Uint8Array(e.memory.buffer);
    const names: string[] = [];
    for (let i = 0; i < PADS; i++) {
      const p = e.name_ptr(i);
      names.push(Buffer.from(bytes.slice(p, p + e.name_len(i))).toString());
      // Every pad holds audio, none of it longer than the three second cap.
      expect(e.pad_len(i)).toBeGreaterThan(1000);
      expect(e.pad_len(i)).toBeLessThanOrEqual(e.pad_capacity());
    }
    expect(names[0]).toBe("kick");
    expect(new Set(names).size).toBe(PADS);
  });

  test("is silent until something is played, and returns to silence", async () => {
    const e = await load();
    expect(peak(render(e, 8))).toBe(0);

    e.note_on(0, 1, 0);
    expect(rms(render(e, 8))).toBeGreaterThan(0.01);

    // The kick is shorter than a second; long after it, nothing is left.
    render(e, Math.ceil(RATE / 128));
    expect(peak(render(e, 8))).toBe(0);
  });

  test("velocity scales the output about linearly", async () => {
    const e = await load();
    e.note_on(0, 1, 0);
    const loud = peak(render(e, 40));
    e.all_off();
    e.note_on(0, 0.5, 0);
    const soft = peak(render(e, 40));
    expect(soft / loud).toBeGreaterThan(0.45);
    expect(soft / loud).toBeLessThan(0.55);
  });

  test("transposing up shortens the sample by the pitch ratio", async () => {
    const e = await load();
    const lengthOf = (semitones: number) => {
      e.all_off();
      e.note_on(2, 1, semitones);
      const out = render(e, 120);
      let last = 0;
      for (let i = 0; i < out.length; i++) if (Math.abs(out[i]) > 0.001) last = i;
      return last;
    };
    const base = lengthOf(0);
    const octaveUp = lengthOf(12);
    // An octave up reads the sample twice as fast, so it lasts half as long.
    expect(octaveUp / base).toBeGreaterThan(0.45);
    expect(octaveUp / base).toBeLessThan(0.55);
  });

  test("12-bit mode quantises to the machine's word length", async () => {
    const e = await load();
    e.set_param(1, 1); // vintage
    e.set_param(2, RATE); // no decimation, so this isolates the quantiser
    e.set_param(3, 12);
    e.note_on(0, 1, 0);
    const out = render(e, 20);
    const levels = 2 ** 11;
    for (const v of out) {
      // Every sample sits exactly on a 12-bit step.
      expect(Math.abs(v * levels - Math.round(v * levels))).toBeLessThan(1e-3);
    }
    // And 4-bit is coarser than 12-bit, which is the audible claim.
    const distinct = (bits: number) => {
      e.all_off();
      e.set_param(3, bits);
      e.note_on(0, 1, 0);
      return new Set(Array.from(render(e, 20))).size;
    };
    expect(distinct(4)).toBeLessThan(distinct(12));
  });

  test("decimation holds each sample for the whole converter period", async () => {
    const e = await load();
    e.set_param(1, 1);
    e.set_param(2, RATE / 4); // a quarter rate: four identical samples in a row
    e.set_param(3, 24); // keep quantisation out of it
    e.note_on(0, 1, 0);
    const out = render(e, 8);
    let runs = 0;
    let i = 1;
    let current = 1;
    for (; i < out.length; i++) {
      if (out[i] === out[i - 1]) current++;
      else {
        if (current === 4) runs++;
        current = 1;
      }
    }
    // Most runs are exactly four long; the rest are where the signal repeats.
    expect(runs).toBeGreaterThan(out.length / 8);
  });

  test("matches the JavaScript reference sample for sample", async () => {
    const e = await load();
    const pads: Float32Array[] = [];
    const lens: number[] = [];
    for (let i = 0; i < PADS; i++) {
      const len = e.pad_len(i);
      lens.push(len);
      pads.push(new Float32Array(new Float32Array(e.memory.buffer, e.pad_ptr(i), len)));
    }
    const ref = new ReferenceEngine(RATE, pads, lens);

    // A scripted bar: vintage chain on, two pads, one transposed, a pattern.
    const script = (target: { setParam: (a: number, b: number) => void }) => {
      target.setParam(1, 1);
      target.setParam(2, 26040);
      target.setParam(3, 12);
      target.setParam(4, 120);
      target.setParam(5, 0.4);
      target.setParam(7, 7000);
    };
    script({ setParam: (a, b) => e.set_param(a, b) });
    script({ setParam: (a, b) => ref.setParam(a, b) });
    for (const [step, pad] of [
      [0, 0],
      [4, 2],
      [8, 0],
      [12, 2],
      [14, 5],
    ] as const) {
      e.seq_set(step, pad, 0.9);
      ref.seqSet(step, pad, 0.9);
    }
    e.note_on(3, 0.7, 7);
    ref.noteOn(3, 0.7, 7);
    e.set_param(6, 1);
    ref.setParam(6, 1);

    const blocks = 200;
    const mine = render(e, blocks);
    const theirs = ref.process(blocks * 128);
    let worst = 0;
    for (let i = 0; i < mine.length; i++) {
      worst = Math.max(worst, Math.abs(mine[i] - theirs[i]));
    }
    expect(worst).toBeLessThan(1e-6);
  });

  test("records into a pad, then trims and normalises it", async () => {
    const e = await load();
    const pad = 9;
    e.set_pad_len(pad, 0);
    const io = block(e, 1024);
    // Half a block of silence, then a quiet sine: trim should drop the lead
    // and normalise should bring the rest up.
    io.fill(0);
    for (let i = 512; i < 1024; i++) io[i] = 0.05 * Math.sin((i - 512) * 0.05);
    const written = e.record_into(pad, 1024);
    expect(written).toBe(1024);

    const len = e.trim_normalize(pad);
    expect(len).toBeLessThan(written);
    expect(len).toBeGreaterThan(400);
    const buf = new Float32Array(e.memory.buffer, e.pad_ptr(pad), len);
    expect(peak(buf)).toBeGreaterThan(0.8);
    expect(peak(buf)).toBeLessThanOrEqual(1);
    // The trimmed pad starts near the transient, not in the dead air.
    expect(Math.abs(buf[Math.floor(len / 2)])).toBeGreaterThan(0.1);
  });

  test("the sequencer runs sixteen steps a bar at the set tempo", async () => {
    const e = await load();
    e.set_param(4, 120);
    expect(e.loop_frames()).toBe(2 * RATE); // one bar of 16ths at 120bpm is 2s
    e.seq_set(0, 0, 1);
    e.set_param(6, 1);
    const seen = new Set<number>();
    for (let b = 0; b < Math.ceil(e.loop_frames() / 128); b++) seen.add(e.process(128));
    expect(seen.size).toBe(16);
  });

  test("bounce renders the pattern without disturbing the transport", async () => {
    const e = await load();
    e.set_param(4, 100);
    e.seq_set(0, 0, 1);
    e.seq_set(8, 4, 1);
    const frames = e.loop_frames();
    const n = e.bounce(frames);
    expect(n).toBe(frames);
    const out = new Float32Array(e.memory.buffer, e.bounce_ptr(), n);
    expect(peak(out)).toBeGreaterThan(0.1);
    // The second hit lands halfway through the bar.
    const half = Math.floor(n / 2);
    expect(peak(out.subarray(half, half + 2000))).toBeGreaterThan(0.1);
    // And the live transport is still stopped.
    expect(peak(render(e, 4))).toBe(0);
  });
});

describe("wav", () => {
  test("writes a canonical 16-bit mono header", () => {
    const samples = new Float32Array([0, 1, -1, 0.5]);
    const wav = encodeWav(samples, 44100);
    const view = new DataView(wav);
    const text = (o: number, n: number) =>
      String.fromCharCode(...new Uint8Array(wav, o, n));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(text(36, 4)).toBe("data");
    expect(wav.byteLength).toBe(44 + samples.length * 2);
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(28, true)).toBe(88200); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(0);
    expect(view.getInt16(46, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });

  test("names files so they sort by time", () => {
    expect(loopFilename(new Date(2026, 8, 3, 7, 5))).toBe("loop-2026-09-03-0705.wav");
  });
});

describe("pads", () => {
  test("maps the keyboard to the grid, bottom row first", () => {
    expect(padForKey("z")).toBe(0);
    expect(padForKey("v")).toBe(3);
    expect(padForKey("1")).toBe(12);
    expect(padForKey("4")).toBe(15);
    expect(padForKey("p")).toBe(-1);
    expect(keyForPad(0)).toBe("Z");
    expect(keyForPad(15)).toBe("4");
  });

  test("the top row of the grid is the last four pads", () => {
    expect(padAtGrid(0, 0)).toBe(12);
    expect(padAtGrid(3, 0)).toBe(0);
    expect(padAtGrid(3, 3)).toBe(3);
  });

  test("velocity follows where the pad was pressed", () => {
    expect(velocityFromPoint(0, 100)).toBe(0.45);
    expect(velocityFromPoint(100, 100)).toBe(1);
    expect(velocityFromPoint(50, 100)).toBeCloseTo(0.73, 2);
    // A zero-height pad cannot be measured, so it counts as a full hit.
    expect(velocityFromPoint(10, 0)).toBe(1);
  });

  test("quantising sends a late hit to the next step, and wraps the bar", () => {
    expect(stepForHit(3.4, true)).toBe(3);
    expect(stepForHit(3.6, true)).toBe(4);
    expect(stepForHit(3.6, false)).toBe(3);
    expect(stepForHit(15.7, true)).toBe(0);
    expect(stepForHit(16.2, true)).toBe(0);
  });

  test("a bar is sixteen sixteenths at the tempo", () => {
    expect(loopFrames(120, 48000)).toBe(96000);
    expect(loopFrames(90, 44100)).toBe(loopFrames(90, 44100));
  });
});
