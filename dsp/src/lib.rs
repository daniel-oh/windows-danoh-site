//! Sampler: the audio engine for the Sampler program on danoh.com.
//!
//! Sixteen pads, sixteen voices, a sixteen step sequencer, and a converter
//! chain that can make any of it sound like it went through a 1980s sampler.
//!
//! The vintage chain follows the behaviour documented by Patina
//! (github.com/lockedown/patina, MIT, Dave Locke), a clean-room study of what
//! an Akai S900/S950 and friends actually do to a sound: linear interpolation
//! when a sample is transposed, a cascaded one-pole lowpass whose cutoff
//! tracks the transpose ratio, true decimation to the machine's rate with
//! zero-order-hold reconstruction, and quantisation to the machine's word
//! length. This is a reading of published behaviour, not anyone's ROM.
//!
//! One deliberate simplification, so the honest version is in the source: the
//! filter is per voice, because its cutoff follows that voice's transpose,
//! while decimation and quantisation run once on the mix bus, the way a whole
//! kit hits one converter. Patina models the converter per instrument.
//!
//! Everything below runs on the audio thread, which gets one 128 frame block
//! every 2.67ms at 48kHz. Nothing here allocates: all memory is static and
//! taken at load.

#![no_std]

mod kit;
mod maths;
mod mem;

use core::ptr::addr_of_mut;
use maths::{abs, one_pole_coeff, powf};

const PADS: usize = 16;
const STEPS: usize = 16;
const VOICES: usize = 16;
/// 6 seconds at 48kHz, the longest a pad can hold. Long enough for two
/// bars of a break at 90bpm, which is what people drop onto a pad.
const PAD_CAP: usize = 288_000;
/// Enough for one 16 step loop down to 40 BPM (about 9.6s).
const BOUNCE_CAP: usize = 480_000;
/// One block is 128 frames; the margin is for hosts that ask for more.
const IO_CAP: usize = 4_096;

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    // Unreachable in practice: there is no indexing here that is not bounded,
    // and the build is panic=abort anyway.
    loop {}
}

#[derive(Clone, Copy)]
struct Voice {
    pad: usize,
    /// Read position in the pad buffer, in frames. f64 so a long pad does not
    /// accumulate position error at unusual rates.
    pos: f64,
    rate: f64,
    gain: f32,
    /// One-pole state and coefficient, cutoff tracking `rate`.
    lp: f32,
    coeff: f32,
    active: bool,
    age: u32,
}

impl Voice {
    const SILENT: Voice = Voice {
        pad: 0,
        pos: 0.0,
        rate: 1.0,
        gain: 0.0,
        lp: 0.0,
        coeff: 1.0,
        active: false,
        age: 0,
    };
}

struct State {
    sample_rate: f32,
    /// PADS * PAD_CAP frames, taken from linear memory at init.
    pads: *mut f32,
    pad_len: [u32; PADS],
    voices: [Voice; VOICES],
    age: u32,

    // Sequencer. velocity 0 means the step is empty.
    pattern: [f32; STEPS * PADS],
    playing: bool,
    step: usize,
    /// Frames until the next step fires.
    to_next: f64,
    bpm: f32,
    swing: f32,

    // Master chain.
    master: f32,
    vintage: bool,
    machine_rate: f32,
    bits: f32,
    cutoff: f32,
    dec_phase: f64,
    held: f32,
    peak: f32,

    /// Record surface: hiss, the odd crackle, and a little saturation. What
    /// turns a clean kit into something that sounds like it was lifted off a
    /// record, which is the whole point of a break.
    vinyl: f32,
    rng: u32,
    pop: f32,

    io: *mut f32,
    bounce: *mut f32,
    ready: bool,
}

static mut STATE: State = State {
    sample_rate: 48_000.0,
    pads: core::ptr::null_mut(),
    pad_len: [0; PADS],
    voices: [Voice::SILENT; VOICES],
    age: 0,
    pattern: [0.0; STEPS * PADS],
    playing: false,
    step: 0,
    to_next: 0.0,
    bpm: 90.0,
    swing: 0.0,
    master: 0.8,
    vintage: false,
    machine_rate: 26_040.0,
    bits: 12.0,
    cutoff: 7_000.0,
    dec_phase: 0.0,
    held: 0.0,
    peak: 0.0,
    vinyl: 0.0,
    rng: 0x2545_f491,
    pop: 0.0,
    io: core::ptr::null_mut(),
    bounce: core::ptr::null_mut(),
    ready: false,
};

#[allow(static_mut_refs)]
fn state() -> &'static mut State {
    // Single-threaded by construction: one AudioWorkletProcessor owns this
    // module and nothing else can reach it.
    unsafe { &mut *addr_of_mut!(STATE) }
}

// ---------------------------------------------------------------- lifecycle

/// Builds the kit at the host's sample rate. Safe to call again if the
/// context changes rate.
#[no_mangle]
pub extern "C" fn init(sample_rate: f32) {
    let s = state();
    if !s.ready {
        s.pads = mem::alloc_f32(PADS * PAD_CAP);
        s.io = mem::alloc_f32(IO_CAP);
        s.bounce = mem::alloc_f32(BOUNCE_CAP);
        s.ready = !s.pads.is_null() && !s.io.is_null() && !s.bounce.is_null();
        if !s.ready {
            return;
        }
    }
    s.sample_rate = if sample_rate > 1.0 { sample_rate } else { 48_000.0 };
    s.voices = [Voice::SILENT; VOICES];
    s.held = 0.0;
    s.dec_phase = 0.0;
    s.rng = 0x2545_f491;
    s.pop = 0.0;
    for pad in 0..PADS {
        let slot = pad_slot(s, pad);
        mem::zero(slot.as_mut_ptr(), PAD_CAP);
        let n = kit::render(pad, s.sample_rate, slot);
        s.pad_len[pad] = n as u32;
    }
}

/// One pad's buffer as a slice. Valid because init took the memory and
/// nothing hands it back.
fn pad_slot(s: &State, pad: usize) -> &'static mut [f32] {
    unsafe { core::slice::from_raw_parts_mut(s.pads.add(pad * PAD_CAP), PAD_CAP) }
}

fn io_slot(s: &State) -> &'static mut [f32] {
    unsafe { core::slice::from_raw_parts_mut(s.io, IO_CAP) }
}

// ------------------------------------------------------------------- memory

#[no_mangle]
pub extern "C" fn pad_ptr(pad: u32) -> *mut f32 {
    let s = state();
    let pad = (pad as usize).min(PADS - 1);
    unsafe { s.pads.add(pad * PAD_CAP) }
}

#[no_mangle]
pub extern "C" fn pad_capacity() -> u32 {
    PAD_CAP as u32
}

#[no_mangle]
pub extern "C" fn pad_len(pad: u32) -> u32 {
    state().pad_len[(pad as usize).min(PADS - 1)]
}

#[no_mangle]
pub extern "C" fn set_pad_len(pad: u32, len: u32) {
    let s = state();
    s.pad_len[(pad as usize).min(PADS - 1)] = len.min(PAD_CAP as u32);
}

/// Scratch the host writes into: one block of input, or one block of output.
#[no_mangle]
pub extern "C" fn io_ptr() -> *mut f32 {
    state().io
}

#[no_mangle]
pub extern "C" fn bounce_ptr() -> *mut f32 {
    state().bounce
}

#[no_mangle]
pub extern "C" fn bounce_capacity() -> u32 {
    BOUNCE_CAP as u32
}

/// Pad names live here so the labels cannot drift from the synthesis.
#[no_mangle]
pub extern "C" fn name_ptr(pad: u32) -> *const u8 {
    kit::NAMES[(pad as usize).min(PADS - 1)].as_ptr()
}

#[no_mangle]
pub extern "C" fn name_len(pad: u32) -> u32 {
    kit::NAMES[(pad as usize).min(PADS - 1)].len() as u32
}

// ------------------------------------------------------------------ control

/// 0 master, 1 vintage on/off, 2 machine rate Hz, 3 word length in bits,
/// 4 tempo BPM, 5 swing 0..0.75, 6 transport, 7 filter cutoff Hz,
/// 8 vinyl 0..1.
#[no_mangle]
pub extern "C" fn set_param(id: u32, value: f32) {
    let s = state();
    match id {
        0 => s.master = value.clamp(0.0, 2.0),
        1 => s.vintage = value >= 0.5,
        2 => s.machine_rate = value.clamp(4_000.0, 96_000.0),
        3 => s.bits = value.clamp(2.0, 24.0),
        4 => s.bpm = value.clamp(40.0, 220.0),
        5 => s.swing = value.clamp(0.0, 0.75),
        6 => {
            let on = value >= 0.5;
            if on && !s.playing {
                // Start from the top, with the first step due immediately.
                s.step = 0;
                s.to_next = 0.0;
            }
            s.playing = on;
        }
        7 => s.cutoff = value.clamp(200.0, 20_000.0),
        8 => s.vinyl = value.clamp(0.0, 1.0),
        _ => {}
    }
}

#[no_mangle]
pub extern "C" fn note_on(pad: u32, velocity: f32, semitones: f32) {
    let s = state();
    if !s.ready {
        return;
    }
    let pad = (pad as usize).min(PADS - 1);
    if s.pad_len[pad] == 0 {
        return;
    }
    let rate = powf(2.0, semitones / 12.0) as f64;
    s.age = s.age.wrapping_add(1);
    // Take a free voice, else the oldest one. Sixteen voices means a busy
    // pattern never runs out in practice.
    let mut slot = 0;
    let mut oldest = u32::MAX;
    let mut found = false;
    for (i, v) in s.voices.iter().enumerate() {
        if !v.active {
            slot = i;
            found = true;
            break;
        }
        if v.age < oldest {
            oldest = v.age;
            slot = i;
        }
    }
    let _ = found;
    let cutoff = s.cutoff * rate as f32;
    s.voices[slot] = Voice {
        pad,
        pos: 0.0,
        rate,
        gain: velocity.clamp(0.0, 1.0),
        lp: 0.0,
        coeff: one_pole_coeff(cutoff, s.sample_rate),
        active: true,
        age: s.age,
    };
}

#[no_mangle]
pub extern "C" fn all_off() {
    state().voices = [Voice::SILENT; VOICES];
}

#[no_mangle]
pub extern "C" fn seq_set(step: u32, pad: u32, velocity: f32) {
    let s = state();
    let step = (step as usize).min(STEPS - 1);
    let pad = (pad as usize).min(PADS - 1);
    s.pattern[step * PADS + pad] = velocity.clamp(0.0, 1.0);
}

#[no_mangle]
pub extern "C" fn seq_get(step: u32, pad: u32) -> f32 {
    let s = state();
    s.pattern[(step as usize).min(STEPS - 1) * PADS + (pad as usize).min(PADS - 1)]
}

#[no_mangle]
pub extern "C" fn seq_clear() {
    state().pattern = [0.0; STEPS * PADS];
}

#[no_mangle]
pub extern "C" fn current_step() -> u32 {
    state().step as u32
}

/// Peak since the last call, for the meter. Reading resets it.
#[no_mangle]
pub extern "C" fn take_peak() -> f32 {
    let s = state();
    let p = s.peak;
    s.peak = 0.0;
    p
}

// ---------------------------------------------------------------- recording

/// Appends `frames` from the io buffer into a pad, returning the new length.
/// Stops at capacity so a long hold cannot run off the end.
#[no_mangle]
pub extern "C" fn record_into(pad: u32, frames: u32) -> u32 {
    let s = state();
    if !s.ready {
        return 0;
    }
    let pad = (pad as usize).min(PADS - 1);
    let slot = pad_slot(s, pad);
    let io = io_slot(s);
    let mut len = s.pad_len[pad] as usize;
    let n = (frames as usize).min(IO_CAP);
    for i in 0..n {
        if len >= PAD_CAP {
            break;
        }
        slot[len] = io[i];
        len += 1;
    }
    s.pad_len[pad] = len as u32;
    len as u32
}

/// Drops leading and trailing silence, then normalises to -1dBFS. What every
/// sampler did to a recording before you could see the waveform.
#[no_mangle]
pub extern "C" fn trim_normalize(pad: u32) -> u32 {
    let s = state();
    if !s.ready {
        return 0;
    }
    let pad = (pad as usize).min(PADS - 1);
    let slot = pad_slot(s, pad);
    let len = s.pad_len[pad] as usize;
    if len == 0 {
        return 0;
    }
    let gate = 0.004; // about -48dBFS
    let mut first = 0;
    while first < len && abs(slot[first]) < gate {
        first += 1;
    }
    if first == len {
        s.pad_len[pad] = 0;
        return 0;
    }
    let mut last = len - 1;
    while last > first && abs(slot[last]) < gate {
        last -= 1;
    }
    // A couple of milliseconds of lead-in so the transient is not clipped off.
    let pre = (0.002 * s.sample_rate) as usize;
    let first = if first > pre { first - pre } else { 0 };
    let new_len = last - first + 1;
    let mut peak = 0.0f32;
    for i in 0..new_len {
        let v = abs(slot[first + i]);
        if v > peak {
            peak = v;
        }
    }
    let gain = if peak > 0.0 { 0.891 / peak } else { 1.0 };
    for i in 0..new_len {
        slot[i] = slot[first + i] * gain;
    }
    // A short fade so a cut tail does not click.
    let fade = (0.003 * s.sample_rate) as usize;
    if new_len > fade {
        for i in 0..fade {
            slot[new_len - fade + i] *= 1.0 - (i as f32 / fade as f32);
        }
    }
    s.pad_len[pad] = new_len as u32;
    new_len as u32
}

// ------------------------------------------------------------------- render

/// xorshift32, so the surface noise is the same every run and the tests can
/// compare against the JavaScript twin sample for sample.
fn next_rand(state: &mut u32) -> f32 {
    let mut x = *state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *state = x;
    (x >> 8) as f32 / 8_388_608.0 - 1.0
}

/// Pade approximation of tanh: the soft knee that keeps a loud bar from
/// tearing, and the reason a hot break sounds thick rather than clipped.
fn saturate(x: f32) -> f32 {
    // The approximation is only a tanh up to |3|, where it reaches exactly
    // 1; past that it grows again, so the input is clamped first. Without
    // that it is not a soft knee at all, just a clipper with extra steps.
    let x = x.clamp(-3.0, 3.0);
    let x2 = x * x;
    x * (27.0 + x2) / (27.0 + 9.0 * x2)
}

fn quantize(x: f32, bits: f32) -> f32 {
    // Mid-tread quantiser at the machine's word length: 12 bits means 2048
    // steps either side of zero. The level count is a shift, not powf: a word
    // length is a whole number, and the approximation in maths.rs would put
    // the steps at 2047.6, which is not a converter anyone built.
    let levels = (1u32 << ((bits as u32).clamp(2, 24) - 1)) as f32;
    let v = x * levels;
    let r = if v >= 0.0 { v + 0.5 } else { v - 0.5 } as i32 as f32;
    let out = r / levels;
    out.clamp(-1.0, 1.0)
}

/// The inner loop. Separated from the exported entry points so the offline
/// bounce runs the exact same code as the live audio thread.
fn render(s: &mut State, out: *mut f32, frames: usize) {
    let step_frames = |bpm: f32, sr: f32| -> f64 {
        // A sixteenth note.
        (60.0 / bpm as f64 / 4.0) * sr as f64
    };

    for i in 0..frames {
        // Sequencer: fire any step that is due before this sample.
        if s.playing {
            if s.to_next <= 0.0 {
                let step = s.step;
                for pad in 0..PADS {
                    let v = s.pattern[step * PADS + pad];
                    if v > 0.0 {
                        note_on(pad as u32, v, 0.0);
                    }
                }
                let base = step_frames(s.bpm, s.sample_rate);
                // Swing pushes the off-beat sixteenths later, which is the
                // whole reason a machine pattern can feel human.
                let next_is_off = (s.step + 1) % 2 == 1;
                let shift = base * s.swing as f64 * 0.5;
                s.to_next += if next_is_off { base + shift } else { base - shift };
                s.step = (s.step + 1) % STEPS;
            }
            s.to_next -= 1.0;
        }

        // Voices.
        let mut mix = 0.0f32;
        for vi in 0..VOICES {
            let v = s.voices[vi];
            if !v.active {
                continue;
            }
            let len = s.pad_len[v.pad] as usize;
            let base = v.pad * PAD_CAP;
            let pos = v.pos;
            let pads = s.pads;
            let idx = pos as usize;
            if idx + 1 >= len {
                s.voices[vi].active = false;
                continue;
            }
            // Linear interpolation, as the S900 and S950 do.
            let frac = (pos - idx as f64) as f32;
            let (a, b) = unsafe { (*pads.add(base + idx), *pads.add(base + idx + 1)) };
            let mut sample = a + (b - a) * frac;
            if s.vintage {
                // One-pole lowpass, cutoff tracking the transpose ratio.
                let lp = s.voices[vi].lp + (sample - s.voices[vi].lp) * v.coeff;
                s.voices[vi].lp = lp;
                sample = lp;
            }
            mix += sample * v.gain;
            s.voices[vi].pos = pos + v.rate;
        }

        if s.vintage {
            // Decimate to the machine rate and hold, then quantise: the
            // converter, in that order.
            s.dec_phase += s.machine_rate as f64 / s.sample_rate as f64;
            if s.dec_phase >= 1.0 {
                s.dec_phase -= 1.0;
                s.held = quantize(mix, s.bits);
            }
            mix = s.held;
        }

        if s.vinyl > 0.0 {
            // Hiss at about -48dBFS, a crackle a dozen times a second, then
            // drive. Added after the converter, the way surface noise arrives
            // after the record was cut.
            let hiss = next_rand(&mut s.rng) * 0.004 * s.vinyl;
            let roll = (next_rand(&mut s.rng) + 1.0) * 0.5;
            if roll < 12.0 / s.sample_rate {
                s.pop = next_rand(&mut s.rng) * 0.22 * s.vinyl;
            }
            mix = saturate((mix + s.pop + hiss) * (1.0 + 0.35 * s.vinyl));
            s.pop *= 0.72;
        }

        // The fader is last, after the converter and the record surface: a
        // machine's crunch does not change when you turn it down, and mute
        // means silence, hiss included.
        mix *= s.master;

        // Soft clip, so a busy bar leans on the ceiling instead of tearing.
        if mix > 1.0 {
            mix = 1.0;
        } else if mix < -1.0 {
            mix = -1.0;
        }

        let a = abs(mix);
        if a > s.peak {
            s.peak = a;
        }

        unsafe {
            *out.add(i) = mix;
        }
    }
}

/// Fills the io buffer with `frames` of audio. The host copies it into its
/// output block.
#[no_mangle]
pub extern "C" fn process(frames: u32) -> u32 {
    let s = state();
    if !s.ready {
        return 0;
    }
    let n = (frames as usize).min(IO_CAP);
    let ptr = s.io;
    render(s, ptr, n);
    s.step as u32
}

/// Renders the pattern from the top into the bounce buffer, faster than real
/// time, using the same code path. Leaves the transport as it found it.
#[no_mangle]
pub extern "C" fn bounce(frames: u32) -> u32 {
    let s = state();
    if !s.ready {
        return 0;
    }
    let n = (frames as usize).min(BOUNCE_CAP);

    let was_playing = s.playing;
    let was_step = s.step;
    let was_to_next = s.to_next;
    let voices = s.voices;
    let held = s.held;
    let dec = s.dec_phase;
    let peak = s.peak;
    let rng = s.rng;
    let pop = s.pop;

    s.playing = true;
    s.step = 0;
    s.to_next = 0.0;
    s.voices = [Voice::SILENT; VOICES];
    s.held = 0.0;
    s.dec_phase = 0.0;
    s.rng = 0x2545_f491;
    s.pop = 0.0;

    let ptr = s.bounce;
    render(s, ptr, n);

    s.playing = was_playing;
    s.step = was_step;
    s.to_next = was_to_next;
    s.voices = voices;
    s.held = held;
    s.dec_phase = dec;
    s.peak = peak;
    s.rng = rng;
    s.pop = pop;
    n as u32
}

/// How many frames one loop of the pattern lasts at the current tempo.
#[no_mangle]
pub extern "C" fn loop_frames() -> u32 {
    let s = state();
    let step = (60.0 / s.bpm as f64 / 4.0) * s.sample_rate as f64;
    (step * STEPS as f64) as u32
}
