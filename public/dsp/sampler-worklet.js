// The Sampler's audio thread.
//
// This runs in an AudioWorkletGlobalScope: no DOM, no fetch, one call to
// process() every 128 frames, which at 48kHz is a block every 2.67ms. Miss one
// and you hear it. So the main thread compiles the wasm and posts the Module
// over the port; this file instantiates it synchronously and from then on does
// nothing but copy floats and call into it.
//
// Loaded by lib/sampler/engine.ts. Plain JS on purpose: it is served from
// public/ and never goes through the bundler.

const BLOCK = 128;

class SamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasm = null;
    this.recording = -1; // pad index while sampling, else -1
    this.lastPost = 0;
    // Blocks completed since the last stats request. An AudioWorkletGlobalScope
    // has no performance.now (only Date and currentTime), so there is no honest
    // way to time a single 2.7ms block from in here; what this can prove is
    // that the audio thread kept getting its blocks while the main thread was
    // busy, which is the property worth having.
    this.blocks = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(msg) {
    const w = this.wasm;
    switch (msg.type) {
      case "init": {
        // The bytes arrive here, not a compiled Module: a WebAssembly.Module
        // cannot be structured-cloned into a worklet (it is a separate agent
        // cluster, and the message is dropped without an error). Compiling
        // synchronously is fine off the main thread.
        try {
          const module = new WebAssembly.Module(msg.bytes);
          this.wasm = new WebAssembly.Instance(module, {}).exports;
          this.wasm.init(sampleRate);
          this.port.postMessage({ type: "ready", names: this.readNames(), rate: sampleRate });
        } catch (err) {
          this.port.postMessage({ type: "failed", message: String(err) });
        }
        break;
      }
      case "note":
        if (w) w.note_on(msg.pad, msg.velocity, msg.semitones || 0);
        break;
      case "param":
        if (w) w.set_param(msg.id, msg.value);
        break;
      case "seq":
        if (w) w.seq_set(msg.step, msg.pad, msg.velocity);
        break;
      case "seqClear":
        if (w) w.seq_clear();
        break;
      case "allOff":
        if (w) w.all_off();
        break;
      case "record":
        // -1 stops. Starting resets the pad so a new take replaces the old.
        if (w && msg.pad >= 0) w.set_pad_len(msg.pad, 0);
        this.recording = msg.pad;
        if (w && msg.pad < 0 && msg.trim >= 0) {
          const len = w.trim_normalize(msg.trim);
          this.port.postMessage({ type: "padLen", pad: msg.trim, len });
          this.postWave(msg.trim);
        }
        break;
      case "wave":
        if (w) this.postWave(msg.pad);
        break;
      case "bounce": {
        if (!w) break;
        const frames = w.bounce(msg.frames);
        const view = new Float32Array(w.memory.buffer, w.bounce_ptr(), frames);
        // Copied, because the buffer is wasm memory that keeps being written.
        const copy = new Float32Array(view);
        this.port.postMessage({ type: "bounced", samples: copy, rate: sampleRate }, [copy.buffer]);
        break;
      }
      case "stats": {
        const blocks = this.blocks;
        this.blocks = 0;
        this.port.postMessage({
          type: "stats",
          blocks,
          frames: blocks * BLOCK,
          time: currentTime,
          budget: (BLOCK / sampleRate) * 1e6,
        });
        break;
      }
      default:
        break;
    }
  }

  readNames() {
    const w = this.wasm;
    const bytes = new Uint8Array(w.memory.buffer);
    const out = [];
    for (let i = 0; i < 16; i++) {
      const p = w.name_ptr(i);
      const n = w.name_len(i);
      // Decoded by hand: an AudioWorkletGlobalScope has no TextDecoder, and
      // the names are ASCII anyway.
      let name = "";
      for (let k = 0; k < n; k++) name += String.fromCharCode(bytes[p + k]);
      out.push(name);
    }
    return out;
  }

  // A min/max envelope for the pad display. Done here because the samples
  // live in wasm memory and this is the thread that owns them.
  postWave(pad) {
    const w = this.wasm;
    const len = w.pad_len(pad);
    const buckets = 96;
    const peaks = new Float32Array(buckets);
    if (len > 0) {
      const src = new Float32Array(w.memory.buffer, w.pad_ptr(pad), len);
      const per = len / buckets;
      for (let b = 0; b < buckets; b++) {
        let peak = 0;
        const start = Math.floor(b * per);
        const end = Math.min(len, Math.floor((b + 1) * per));
        for (let i = start; i < end; i++) {
          const v = src[i] < 0 ? -src[i] : src[i];
          if (v > peak) peak = v;
        }
        peaks[b] = peak;
      }
    }
    this.port.postMessage({ type: "wave", pad, len, peaks }, [peaks.buffer]);
  }

  process(inputs, outputs) {
    const w = this.wasm;
    const out = outputs[0];
    if (!w) return true;

    const frames = out[0].length;
    const t0 = currentTime;
    this.blocks++;

    // Recording first: record_into consumes the io buffer, then process()
    // fills the same buffer with output. One scratch buffer, two uses, no
    // allocation in either direction.
    if (this.recording >= 0) {
      const chan = inputs[0] && inputs[0][0];
      if (chan && chan.length) {
        new Float32Array(w.memory.buffer, w.io_ptr(), chan.length).set(chan);
        const len = w.record_into(this.recording, chan.length);
        if (len >= w.pad_capacity()) {
          // Hit the three second ceiling: stop and tell the UI.
          const pad = this.recording;
          this.recording = -1;
          this.port.postMessage({ type: "recordFull", pad, len });
        }
      }
    }

    const step = w.process(frames);
    const io = new Float32Array(w.memory.buffer, w.io_ptr(), frames);
    for (let c = 0; c < out.length; c++) out[c].set(io);

    // The UI needs the playhead and the meter, not every block: about 30 a
    // second is enough to look live and cheap enough to be free.
    if (t0 - this.lastPost > 0.033) {
      this.lastPost = t0;
      this.port.postMessage({ type: "tick", step, peak: w.take_peak() });
    }
    return true;
  }
}

registerProcessor("sampler", SamplerProcessor);
