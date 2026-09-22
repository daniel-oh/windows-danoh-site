"use client";

// The main thread's half of the Sampler: owns the AudioContext, loads the
// worklet and the wasm, and turns pad presses into port messages. Everything
// that touches audio samples happens on the other side of that port.
//
// Nothing here is created until the first gesture, because browsers will not
// start an AudioContext before one, and because a visitor who never opens the
// program should not pay for any of it.

export const PARAM = {
  master: 0,
  vintage: 1,
  machineRate: 2,
  bits: 3,
  bpm: 4,
  swing: 5,
  playing: 6,
  cutoff: 7,
  vinyl: 8,
} as const;

export type Stats = {
  /** Blocks the audio thread completed since the last call. */
  blocks: number;
  frames?: number;
  /** The audio thread's own clock, in seconds. */
  time?: number;
  /** Microseconds available per block at this sample rate. */
  budget?: number;
};

export type Wave = { pad: number; len: number; peaks: Float32Array };

type Handlers = {
  onTick?: (step: number, peak: number) => void;
  onWave?: (wave: Wave) => void;
  onPadLen?: (pad: number, len: number, loaded?: boolean) => void;
  onRecordFull?: (pad: number) => void;
};

export class SamplerEngine {
  readonly ctx: AudioContext;
  readonly node: AudioWorkletNode;
  readonly names: string[];
  readonly sampleRate: number;
  private handlers: Handlers = {};
  private mic: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private closed = false;

  private constructor(ctx: AudioContext, node: AudioWorkletNode, names: string[]) {
    this.ctx = ctx;
    this.node = node;
    this.names = names;
    this.sampleRate = ctx.sampleRate;
    node.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === "tick") this.handlers.onTick?.(m.step, m.peak);
      else if (m.type === "wave") this.handlers.onWave?.(m as Wave);
      else if (m.type === "padLen") this.handlers.onPadLen?.(m.pad, m.len, m.loaded);
      else if (m.type === "recordFull") this.handlers.onRecordFull?.(m.pad);
    };
  }

  static supported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof AudioWorkletNode !== "undefined" &&
      typeof WebAssembly !== "undefined" &&
      (typeof AudioContext !== "undefined" ||
        typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !==
          "undefined")
    );
  }

  /** Call from a user gesture. Resolves once the kit is built and audible. */
  static async create(): Promise<SamplerEngine> {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: "interactive" });
    // Safari hands back a suspended context even inside a gesture.
    if (ctx.state === "suspended") await ctx.resume();

    // The worklet module and the wasm bytes load in parallel. The bytes are
    // sent across as bytes: a worklet has no fetch, and a compiled
    // WebAssembly.Module cannot be posted to one (it is a separate agent
    // cluster, and the message vanishes without an error).
    const [, bytes] = await Promise.all([
      ctx.audioWorklet.addModule("/dsp/sampler-worklet.js"),
      fetch("/dsp/sampler.wasm").then((r) => {
        if (!r.ok) throw new Error(`sampler.wasm ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);

    const node = new AudioWorkletNode(ctx, "sampler", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    node.connect(ctx.destination);

    const names = await new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("sampler worklet did not start")), 5000);
      node.port.onmessage = (e) => {
        if (e.data?.type === "ready") {
          clearTimeout(timer);
          resolve(e.data.names as string[]);
        } else if (e.data?.type === "failed") {
          clearTimeout(timer);
          reject(new Error(e.data.message));
        }
      };
      node.port.postMessage({ type: "init", bytes }, [bytes]);
    });

    return new SamplerEngine(ctx, node, names);
  }

  on(handlers: Handlers) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  hit(pad: number, velocity = 1, semitones = 0) {
    this.node.port.postMessage({ type: "note", pad, velocity, semitones });
  }

  setParam(id: number, value: number) {
    this.node.port.postMessage({ type: "param", id, value });
  }

  setStep(step: number, pad: number, velocity: number) {
    this.node.port.postMessage({ type: "seq", step, pad, velocity });
  }

  clearPattern() {
    this.node.port.postMessage({ type: "seqClear" });
  }

  allOff() {
    this.node.port.postMessage({ type: "allOff" });
  }

  requestWave(pad: number) {
    this.node.port.postMessage({ type: "wave", pad });
  }

  /** Opens the mic (asking permission the first time) and records into a pad. */
  async startRecording(pad: number) {
    if (!this.mic) {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          // A sampler wants the room, not a phone call: the three cleanups
          // below are what make a recorded snare sound like a voice memo.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      this.micSource = this.ctx.createMediaStreamSource(this.mic);
      this.micSource.connect(this.node);
    }
    this.node.port.postMessage({ type: "record", pad });
  }

  /** Decodes a file at the context's rate and puts it on a pad. Mono,
   * because a pad is one voice; the file never leaves the browser. */
  async loadFile(pad: number, file: File) {
    return this.loadAudio(pad, await file.arrayBuffer());
  }

  /** The same, for bytes that came from somewhere other than a file picker,
   * such as the desktop's own filesystem. */
  async loadAudio(pad: number, bytes: ArrayBuffer) {
    const decoded = await this.ctx.decodeAudioData(bytes);
    const frames = decoded.length;
    const mono = new Float32Array(frames);
    const channels = decoded.numberOfChannels;
    for (let c = 0; c < channels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < frames; i++) mono[i] += data[i] / channels;
    }
    this.node.port.postMessage({ type: "load", pad, samples: mono }, [mono.buffer]);
    return { seconds: frames / decoded.sampleRate };
  }

  /** Stops recording and trims and normalises what was captured. */
  stopRecording(pad: number) {
    this.node.port.postMessage({ type: "record", pad: -1, trim: pad });
  }

  /** Drops the microphone entirely, which is what turns the browser's
   * recording indicator off. */
  releaseMic() {
    this.micSource?.disconnect();
    this.micSource = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }

  micOpen(): boolean {
    return !!this.mic;
  }

  /** Renders the pattern faster than real time through the same DSP. */
  bounce(frames: number): Promise<{ samples: Float32Array; rate: number }> {
    return new Promise((resolve) => {
      const port = this.node.port;
      const prev = port.onmessage;
      port.onmessage = (e) => {
        if (e.data?.type === "bounced") {
          port.onmessage = prev;
          resolve({ samples: e.data.samples, rate: e.data.rate });
          return;
        }
        prev?.call(port, e);
      };
      port.postMessage({ type: "bounce", frames });
    });
  }

  /** How many blocks the audio thread completed since the last call. Used by
   * the benchmark to show it kept running while the main thread was stuck. */
  stats(): Promise<Stats> {
    return new Promise((resolve) => {
      const port = this.node.port;
      const prev = port.onmessage;
      port.onmessage = (e) => {
        if (e.data?.type === "stats") {
          port.onmessage = prev;
          resolve(e.data as Stats);
          return;
        }
        prev?.call(port, e);
      };
      port.postMessage({ type: "stats" });
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.releaseMic();
    try {
      this.node.port.postMessage({ type: "allOff" });
      this.node.disconnect();
    } catch {
      // The node can already be gone if the context was closed first.
    }
    void this.ctx.close();
  }
}
