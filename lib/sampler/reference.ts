// The same DSP as dsp/src/lib.rs, in JavaScript.
//
// It exists twice on purpose. As a test oracle it proves the Rust does what it
// claims sample by sample, and as a benchmark it answers the only honest
// version of "is the Rust worth it": the same algorithm, the same arithmetic,
// two languages, measured on the same audio thread.
//
// Every intermediate is pushed through Math.fround because the Rust side is
// f32 throughout, except the voice read position, which is f64 in both.

const f = Math.fround;

// --- the maths from dsp/src/maths.rs, kept bit-comparable ---------------

const scratch = new Float32Array(1);
const scratchBits = new Uint32Array(scratch.buffer);

export function exp2(x: number): number {
  if (x < -126) return 0;
  if (x > 127) return Infinity;
  const i = Math.floor(x);
  const frac = f(x - i);
  const poly = f(
    1 + frac * f(0.6563662 + frac * f(0.3395573 + frac * 0.0307604))
  );
  scratchBits[0] = ((i + 127) >>> 0) << 23;
  return f(poly * scratch[0]);
}

export function exp(x: number): number {
  return exp2(f(x * 1.4426950));
}

export function log2(x: number): number {
  if (x <= 0) return -Infinity;
  scratch[0] = x;
  const bits = scratchBits[0];
  const e = ((bits >>> 23) & 0xff) - 127;
  scratchBits[0] = (bits & 0x007fffff) | 0x3f800000;
  const m = scratch[0];
  const p = f(-1.7195958 + m * f(2.8212026 + m * f(-1.4696224 + m * 0.3678745)));
  return f(e + p);
}

export function powf(x: number, y: number): number {
  if (x <= 0) return 0;
  return exp2(f(log2(x) * y));
}

export function onePoleCoeff(cutoffHz: number, sampleRate: number): number {
  if (cutoffHz <= 0) return 0;
  if (cutoffHz >= sampleRate * 0.5) return 1;
  return f(1 - exp(f((-2 * Math.PI * cutoffHz) / sampleRate)));
}

// --- the engine ---------------------------------------------------------

export const PADS = 16;
export const STEPS = 16;
const VOICES = 16;

type Voice = {
  pad: number;
  pos: number;
  rate: number;
  gain: number;
  lp: number;
  coeff: number;
  active: boolean;
  age: number;
};

const silent = (): Voice => ({
  pad: 0,
  pos: 0,
  rate: 1,
  gain: 0,
  lp: 0,
  coeff: 1,
  active: false,
  age: 0,
});

export class ReferenceEngine {
  private voices: Voice[] = Array.from({ length: VOICES }, silent);
  private age = 0;
  private pattern = new Float32Array(STEPS * PADS);
  private playing = false;
  private step = 0;
  private toNext = 0;
  private bpm = 90;
  private swing = 0;
  private master = f(0.8);
  private vintage = false;
  private machineRate = 26040;
  private bits = 12;
  private cutoff = 7000;
  private decPhase = 0;
  private held = 0;
  private vinyl = 0;
  private rng = 0x2545f491;
  private pop = 0;

  constructor(
    private sampleRate: number,
    private pads: Float32Array[],
    private lens: number[]
  ) {}

  setParam(id: number, value: number) {
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    switch (id) {
      case 0:
        this.master = f(clamp(value, 0, 2));
        break;
      case 1:
        this.vintage = value >= 0.5;
        break;
      case 2:
        this.machineRate = f(clamp(value, 4000, 96000));
        break;
      case 3:
        this.bits = f(clamp(value, 2, 24));
        break;
      case 4:
        this.bpm = f(clamp(value, 40, 220));
        break;
      case 5:
        this.swing = f(clamp(value, 0, 0.75));
        break;
      case 6: {
        const on = value >= 0.5;
        if (on && !this.playing) {
          this.step = 0;
          this.toNext = 0;
        }
        this.playing = on;
        break;
      }
      case 7:
        this.cutoff = f(clamp(value, 200, 20000));
        break;
      case 8:
        this.vinyl = f(clamp(value, 0, 1));
        break;
      default:
        break;
    }
  }

  noteOn(pad: number, velocity: number, semitones = 0) {
    pad = Math.min(PADS - 1, pad);
    if (!this.lens[pad]) return;
    const rate = powf(2, f(semitones / 12));
    this.age++;
    let slot = 0;
    let oldest = Infinity;
    for (let i = 0; i < VOICES; i++) {
      const v = this.voices[i];
      if (!v.active) {
        slot = i;
        break;
      }
      if (v.age < oldest) {
        oldest = v.age;
        slot = i;
      }
    }
    this.voices[slot] = {
      pad,
      pos: 0,
      rate,
      gain: f(Math.min(1, Math.max(0, velocity))),
      lp: 0,
      coeff: onePoleCoeff(f(this.cutoff * rate), this.sampleRate),
      active: true,
      age: this.age,
    };
  }

  seqSet(step: number, pad: number, velocity: number) {
    this.pattern[step * PADS + pad] = f(velocity);
  }

  /** xorshift32, matching dsp/src/lib.rs bit for bit. */
  private rand(): number {
    let x = this.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rng = x >>> 0;
    return f((this.rng >>> 8) / 8388608 - 1);
  }

  private saturate(x: number): number {
    const c = f(Math.min(3, Math.max(-3, x)));
    const x2 = f(c * c);
    return f(f(c * f(27 + x2)) / f(27 + f(9 * x2)));
  }

  private quantize(x: number): number {
    // A shift, matching dsp/src/lib.rs: word lengths are whole numbers.
    const levels = f(1 << (Math.min(24, Math.max(2, Math.trunc(this.bits))) - 1));
    const v = f(x * levels);
    const r = Math.trunc(v >= 0 ? v + 0.5 : v - 0.5);
    return Math.min(1, Math.max(-1, f(r / levels)));
  }

  process(frames: number, out = new Float32Array(frames)): Float32Array {
    const stepFrames = (60 / this.bpm / 4) * this.sampleRate;
    for (let i = 0; i < frames; i++) {
      if (this.playing) {
        if (this.toNext <= 0) {
          const step = this.step;
          for (let pad = 0; pad < PADS; pad++) {
            const v = this.pattern[step * PADS + pad];
            if (v > 0) this.noteOn(pad, v, 0);
          }
          const nextIsOff = (this.step + 1) % 2 === 1;
          const shift = stepFrames * this.swing * 0.5;
          this.toNext += nextIsOff ? stepFrames + shift : stepFrames - shift;
          this.step = (this.step + 1) % STEPS;
        }
        this.toNext -= 1;
      }

      let mix = 0;
      for (let vi = 0; vi < VOICES; vi++) {
        const v = this.voices[vi];
        if (!v.active) continue;
        const len = this.lens[v.pad];
        const idx = Math.floor(v.pos);
        if (idx + 1 >= len) {
          v.active = false;
          continue;
        }
        const frac = f(v.pos - idx);
        const buf = this.pads[v.pad];
        const a = buf[idx];
        const b = buf[idx + 1];
        let sample = f(a + f(f(b - a) * frac));
        if (this.vintage) {
          v.lp = f(v.lp + f(f(sample - v.lp) * v.coeff));
          sample = v.lp;
        }
        mix = f(mix + f(sample * v.gain));
        v.pos += v.rate;
      }

      if (this.vintage) {
        this.decPhase += this.machineRate / this.sampleRate;
        if (this.decPhase >= 1) {
          this.decPhase -= 1;
          this.held = this.quantize(mix);
        }
        mix = this.held;
      }

      if (this.vinyl > 0) {
        const hiss = f(f(this.rand() * 0.004) * this.vinyl);
        const roll = f(f(this.rand() + 1) * 0.5);
        if (roll < 12 / this.sampleRate) {
          this.pop = f(f(this.rand() * 0.22) * this.vinyl);
        }
        mix = this.saturate(f(f(mix + this.pop + hiss) * f(1 + f(0.35 * this.vinyl))));
        this.pop = f(this.pop * 0.72);
      }

      // The fader is last: see dsp/src/lib.rs.
      mix = f(mix * this.master);

      if (mix > 1) mix = 1;
      else if (mix < -1) mix = -1;
      out[i] = mix;
    }
    return out;
  }
}
