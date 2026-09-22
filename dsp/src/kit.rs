//! The kit, synthesised at init. Sixteen one-shots built from sine sweeps and
//! noise, so the program ships no audio files at all: the drums are a function,
//! not a download.

use crate::maths::{exp, sin};

/// xorshift32. Deterministic on purpose: the same kit every time, which is
/// what makes the DSP tests reproducible.
pub struct Noise(u32);

impl Noise {
    pub fn new(seed: u32) -> Self {
        Noise(seed | 1)
    }
    pub fn next(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.0 = x;
        (x as f32 / u32::MAX as f32) * 2.0 - 1.0
    }
}

/// A sine whose pitch falls exponentially: the shape under every kick and tom.
fn swept_sine(t: f32, f0: f32, f1: f32, sweep: f32) -> f32 {
    // Instantaneous frequency f0 -> f1 with time constant `sweep`, integrated
    // for constant-phase continuity.
    let k = exp(-t / sweep);
    let phase = 2.0 * core::f32::consts::PI * (f1 * t + (f0 - f1) * sweep * (1.0 - k));
    sin(phase)
}

fn decay(t: f32, tau: f32) -> f32 {
    exp(-t / tau)
}

/// Writes one of the sixteen voices into `buf`, returning how many frames it
/// used. Pads are laid out bottom-left first, the way the grid reads.
pub fn render(index: usize, sample_rate: f32, buf: &mut [f32]) -> usize {
    let mut noise = Noise::new(0x9e37_79b9 ^ (index as u32 + 1).wrapping_mul(2_654_435_761));
    let sr = sample_rate;
    let len = |secs: f32| -> usize {
        let n = (secs * sr) as usize;
        if n > buf.len() {
            buf.len()
        } else {
            n
        }
    };

    // Each arm fills buf[..n] and returns n.
    match index {
        // 1 kick
        0 => {
            let n = len(0.45);
            for i in 0..n {
                let t = i as f32 / sr;
                let body = swept_sine(t, 120.0, 47.0, 0.035) * decay(t, 0.16);
                let click = noise.next() * decay(t, 0.004) * 0.35;
                buf[i] = clip(body * 0.95 + click);
            }
            n
        }
        // 2 tight kick
        1 => {
            let n = len(0.28);
            for i in 0..n {
                let t = i as f32 / sr;
                buf[i] = clip(swept_sine(t, 180.0, 55.0, 0.02) * decay(t, 0.075) * 0.95);
            }
            n
        }
        // 3 snare
        2 => {
            let n = len(0.33);
            let mut hp = 0.0;
            for i in 0..n {
                let t = i as f32 / sr;
                let tone = (swept_sine(t, 330.0, 180.0, 0.03) * 0.5
                    + sin(2.0 * core::f32::consts::PI * 185.0 * t) * 0.3)
                    * decay(t, 0.1);
                let raw = noise.next();
                hp += (raw - hp) * 0.55; // a lowpassed noise, subtracted to tilt it bright
                let rattle = (raw - hp) * decay(t, 0.13) * 0.8;
                buf[i] = clip(tone * 0.6 + rattle);
            }
            n
        }
        // 4 rim
        3 => {
            let n = len(0.09);
            for i in 0..n {
                let t = i as f32 / sr;
                let d = decay(t, 0.012);
                buf[i] = clip(
                    (sin(2.0 * core::f32::consts::PI * 1_700.0 * t) * 0.6
                        + sin(2.0 * core::f32::consts::PI * 470.0 * t) * 0.4)
                        * d,
                );
            }
            n
        }
        // 5 clap: three short bursts then a tail, the 909 trick
        4 => {
            let n = len(0.42);
            let mut lp = 0.0;
            for i in 0..n {
                let t = i as f32 / sr;
                let burst = if t < 0.011 {
                    1.0
                } else if t < 0.022 {
                    decay(t - 0.011, 0.004)
                } else if t < 0.033 {
                    decay(t - 0.022, 0.004)
                } else {
                    decay(t - 0.033, 0.11) * 0.8
                };
                let raw = noise.next();
                lp += (raw - lp) * 0.35;
                buf[i] = clip((raw - lp * 0.6) * burst * 0.9);
            }
            n
        }
        // 6 closed hat, 7 open hat
        5 | 6 => {
            let (secs, tau) = if index == 5 { (0.08, 0.018) } else { (0.5, 0.2) };
            let n = len(secs);
            let mut lp = 0.0;
            for i in 0..n {
                let t = i as f32 / sr;
                let raw = noise.next();
                lp += (raw - lp) * 0.75;
                buf[i] = clip((raw - lp) * decay(t, tau) * 0.75);
            }
            n
        }
        // 8, 9, 10 toms
        7 | 8 | 9 => {
            let f = [110.0f32, 165.0, 240.0][index - 7];
            let n = len(0.4);
            for i in 0..n {
                let t = i as f32 / sr;
                let body = swept_sine(t, f * 1.6, f, 0.045) * decay(t, 0.17);
                buf[i] = clip(body * 0.9 + noise.next() * decay(t, 0.006) * 0.2);
            }
            n
        }
        // 11 cowbell
        10 => {
            let n = len(0.3);
            for i in 0..n {
                let t = i as f32 / sr;
                let d = decay(t, 0.12);
                let a = sin(2.0 * core::f32::consts::PI * 587.0 * t);
                let b = sin(2.0 * core::f32::consts::PI * 845.0 * t);
                // Square-ish, the way the real one sounds.
                buf[i] = clip((sign(a) * 0.5 + sign(b) * 0.5) * d * 0.55);
            }
            n
        }
        // 12 clave
        11 => {
            let n = len(0.12);
            for i in 0..n {
                let t = i as f32 / sr;
                buf[i] =
                    clip(sin(2.0 * core::f32::consts::PI * 1_200.0 * t) * decay(t, 0.02) * 0.9);
            }
            n
        }
        // 13 shaker
        12 => {
            let n = len(0.16);
            let mut lp = 0.0;
            for i in 0..n {
                let t = i as f32 / sr;
                let raw = noise.next();
                lp += (raw - lp) * 0.6;
                let env = if t < 0.02 { t / 0.02 } else { decay(t - 0.02, 0.05) };
                buf[i] = clip((raw - lp) * env * 0.6);
            }
            n
        }
        // 14 zap
        13 => {
            let n = len(0.25);
            for i in 0..n {
                let t = i as f32 / sr;
                buf[i] = clip(swept_sine(t, 1_800.0, 90.0, 0.05) * decay(t, 0.1) * 0.8);
            }
            n
        }
        // 15 blip
        14 => {
            let n = len(0.1);
            for i in 0..n {
                let t = i as f32 / sr;
                let f = if t < 0.04 { 880.0 } else { 1_320.0 };
                buf[i] = clip(sign(sin(2.0 * core::f32::consts::PI * f * t)) * decay(t, 0.04) * 0.5);
            }
            n
        }
        // 16 sweep up
        _ => {
            let n = len(0.5);
            let mut lp = 0.0;
            for i in 0..n {
                let t = i as f32 / sr;
                let raw = noise.next();
                // Opening filter: the coefficient rises with time.
                let k = 0.02 + 0.6 * (t / 0.5);
                lp += (raw - lp) * k;
                buf[i] = clip(lp * (t / 0.5) * 1.4);
            }
            n
        }
    }
}

fn clip(x: f32) -> f32 {
    if x > 1.0 {
        1.0
    } else if x < -1.0 {
        -1.0
    } else {
        x
    }
}

fn sign(x: f32) -> f32 {
    if x >= 0.0 {
        1.0
    } else {
        -1.0
    }
}

/// Short labels for the UI, kept beside the synthesis so they cannot drift.
pub const NAMES: [&str; 16] = [
    "kick", "kick 2", "snare", "rim", "clap", "hat", "open hat", "tom lo", "tom mid", "tom hi",
    "cowbell", "clave", "shaker", "zap", "blip", "sweep",
];
