"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { windowAtomFamily } from "@/state/window";
import { getFsManager } from "@/state/fsManager";
import { useIsMobile } from "@/lib/useIsMobile";
import { useMotionAllowed } from "@/lib/useMotionAllowed";
import { FileTooLargeError, PARAM, SamplerEngine, type Wave } from "@/lib/sampler/engine";

// The engine clamps tempo to this range too (dsp/src/lib.rs, param 4).
const MIN_BPM = 40;
const MAX_BPM = 220;
const clampBpm = (v: number) => Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, v)));
import {
  DEFAULT_VELOCITY,
  PADS,
  STEPS,
  keyForPad,
  loopFrames,
  padAtGrid,
  padForKeyEvent,
  secondsLabel,
  stepForHit,
  velocityFromPoint,
} from "@/lib/sampler/pads";
import { PRESETS, presetSteps } from "@/lib/sampler/presets";
import { gainFor, levelLabel, readVolume, writeVolume } from "@/lib/sampler/volume";
import { encodeWav, loopFilename } from "@/lib/sampler/wav";
import styles from "./Sampler.module.css";

// A sixteen pad sampler in a Win98 window. The kit is synthesised in Rust at
// load, the microphone can replace any pad, and the sixteen step sequencer
// runs on the audio thread so it keeps time while the browser is busy.
//
// The UI deliberately does not re-render on the audio clock: the playhead and
// the level meter are written straight to their elements, thirty times a
// second, so holding a chord down never costs a React render.

// A pixel speaker, drawn rather than imported, like the other glyphs on
// this desktop. Crossed out when muted, so the state is not colour alone.
function Speaker({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 11 11" width="11" height="11" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M1 4h2l3-3v9l-3-3H1z" fill="currentColor" />
      {muted ? (
        <path d="M7 4h1v1h1V4h1v1H9v1h1v1H9V6H8v1H7V6h1V5H7z" fill="currentColor" />
      ) : (
        <path d="M7 3h1v5H7zM9 2h1v7H9z" fill="currentColor" />
      )}
    </svg>
  );
}

const SAMPLES_DIR = "/user/My Samples";

export function Sampler({ id }: { id: string }) {
  const win = useAtomValue(windowAtomFamily(id));
  const openWith = win.program.type === "sampler" ? win.program.loadPath : undefined;
  // 98.css draws a checkbox from the label beside the input, so each one
  // needs a real id: nesting the input inside the label renders no box.
  const uid = useId();
  const mobile = useIsMobile();
  const motion = useMotionAllowed();

  const engineRef = useRef<SamplerEngine | null>(null);
  const [phase, setPhase] = useState<"off" | "starting" | "on" | "blocked">(() =>
    typeof window === "undefined" || SamplerEngine.supported() ? "off" : "blocked"
  );
  const [names, setNames] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const [pattern, setPattern] = useState<number[]>(() => new Array(STEPS * PADS).fill(0));
  const [playing, setPlaying] = useState(false);
  const [armed, setArmed] = useState(false);
  const [quantize, setQuantize] = useState(true);
  const [vintage, setVintage] = useState(false);
  const [bpm, setBpm] = useState(90);
  // What is in the tempo box while it is being typed. The engine only
  // plays 40 to 220, and the loop length, recorded hits and export all
  // read `bpm`, so `bpm` only ever holds a value the engine agrees with.
  const [tempoDraft, setTempoDraft] = useState<string | null>(null);
  const [swing, setSwing] = useState(0);
  const [sampling, setSampling] = useState(false);
  const [recorded, setRecorded] = useState<boolean[]>(() => new Array(PADS).fill(false));
  const [wave, setWave] = useState<Wave | null>(null);
  const [say, setSay] = useState("");
  const [preset, setPreset] = useState("");
  const [vinyl, setVinyl] = useState(false);
  // Remembered across visits: a volume you have to set every time is a
  // volume that is wrong every time.
  const [{ level, muted }, setVolume] = useState(() => readVolume());
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropPad, setDropPad] = useState(-1);

  const padRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const meterRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const startedAt = useRef(0);
  const lastStep = useRef(-1);
  // Live values the handlers need without re-subscribing.
  const live = useRef({ armed, quantize, playing, bpm, selected });
  live.current = { armed, quantize, playing, bpm, selected };

  // Whether Sample is still being held, and which pad the take is going
  // into (the selection can move mid-take with a second finger or a key).
  const held = useRef(false);
  const takePad = useRef(-1);

  // Every way a take ends goes through here: let go, full, minimised, tab
  // hidden. The mic always goes with it, so the browser's recording light
  // never outlives the take.
  const endTake = useCallback((announce: boolean) => {
    held.current = false;
    const pad = takePad.current;
    takePad.current = -1;
    const engine = engineRef.current;
    if (!engine) return;
    if (pad >= 0) engine.stopRecording(pad);
    engine.releaseMic();
    setSampling(false);
    // The result is announced by onPadLen, which knows whether anything
    // survived the trim.
    if (announce && pad >= 0) setSay(`Pad ${pad + 1} captured`);
  }, []);

  // --------------------------------------------------------------- engine

  // Two presses during startup must not build two audio contexts, and a
  // window closed during startup must not be left holding one.
  const creating = useRef<Promise<SamplerEngine | null> | null>(null);
  const unmounted = useRef(false);

  const ensure = useCallback(async (): Promise<SamplerEngine | null> => {
    if (engineRef.current) return engineRef.current;
    if (creating.current) return creating.current;
    if (!SamplerEngine.supported()) {
      setPhase("blocked");
      return null;
    }
    creating.current = start();
    try {
      return await creating.current;
    } finally {
      creating.current = null;
    }
  // `start` is the stable body below; see its note.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start(): Promise<SamplerEngine | null> {
    setPhase("starting");
    try {
      const engine = await SamplerEngine.create();
      if (unmounted.current) {
        engine.close();
        return null;
      }
      engine.on({
        onTick: (step, peak) => {
          if (meterRef.current) {
            meterRef.current.style.width = `${Math.round(Math.min(1, peak) * 100)}%`;
          }
          if (step !== lastStep.current) {
            const prev = stepRefs.current[lastStep.current];
            if (prev) delete prev.dataset.play;
            const next = stepRefs.current[step];
            if (next) next.dataset.play = "";
            lastStep.current = step;
          }
        },
        onWave: (w) => setWave(w),
        onPadLen: (pad, len, loaded) => {
          setRecorded((prev) => {
            const next = [...prev];
            next[pad] = len > 0;
            return next;
          });
          // A take that trims to nothing was silence. Say so, rather than
          // leaving a pad that looks loaded and makes no sound.
          if (len === 0 && !loaded) {
            setSay(`Pad ${pad + 1} recorded silence. Check the microphone and try again.`);
          }
        },
        onRecordFull: (pad) => {
          endTake(false);
          setSay(`Pad ${pad + 1} is full at ${secondsLabel(engine.padSeconds)} seconds.`);
        },
      });
      engineRef.current = engine;
      setNames(engine.names);
      setPhase("on");
      engine.setParam(PARAM.bpm, bpm);
      engine.setParam(PARAM.swing, swing);
      engine.setParam(PARAM.vintage, vintage ? 1 : 0);
      engine.setParam(PARAM.vinyl, vinyl ? 1 : 0);
      engine.setParam(PARAM.master, gainFor(level, muted));
      engine.requestWave(live.current.selected);
      return engine;
    } catch {
      setPhase("blocked");
      return null;
    }
    // The engine is created once; the values above are its starting
    // values, so they are read rather than subscribed to.
  }

  // The program holds a real audio device, so it lets go on close, on
  // minimise and when the tab goes away, the same rule the Camera follows.
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      engineRef.current?.close();
      engineRef.current = null;
    };
  }, []);

  // iOS starts audio only from a gesture that has ended. Pads play on
  // pointerdown for feel, so the release is what actually unlocks the
  // sound; listened for on the whole window, capture phase, so no handler
  // can swallow it.
  useEffect(() => {
    const unlock = () => SamplerEngine.unlockAudio();
    const events = ["touchend", "pointerup", "click", "keydown"] as const;
    for (const ev of events) window.addEventListener(ev, unlock, { capture: true, passive: true });
    return () => {
      for (const ev of events) window.removeEventListener(ev, unlock, { capture: true });
    };
  }, []);

  const minimized = win.status === "minimized";
  useEffect(() => {
    if (!minimized) return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.setParam(PARAM.playing, 0);
    engine.allOff();
    // Now, not on the next tick: this is what turns the recording light off.
    engine.releaseMic();
    const t = setTimeout(() => {
      setPlaying(false);
      endTake(false);
    }, 0);
    return () => clearTimeout(t);
  }, [minimized, endTake]);

  useEffect(() => {
    const onHide = () => {
      if (!document.hidden) return;
      const engine = engineRef.current;
      if (!engine) return;
      engine.setParam(PARAM.playing, 0);
      engine.allOff();
      setPlaying(false);
      endTake(false);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [endTake]);

  // ----------------------------------------------------------------- play

  const flash = useCallback(
    (pad: number) => {
      const el = padRefs.current[pad];
      if (!el) return;
      el.dataset.hit = "";
      // Held long enough to see at 30fps, short enough to read as a hit.
      setTimeout(() => delete el.dataset.hit, motion ? 90 : 140);
    },
    [motion]
  );

  const hit = useCallback(
    async (pad: number, velocity: number) => {
      const engine = engineRef.current ?? (await ensure());
      if (!engine) return;
      engine.hit(pad, velocity);
      flash(pad);
      if (mobile && typeof navigator.vibrate === "function") navigator.vibrate(8);

      const { armed: rec, quantize: q, playing: isPlaying, bpm: tempo } = live.current;
      if (rec && isPlaying) {
        // Where in the bar the hit landed, from the audio clock rather than
        // from the thirty-a-second UI tick.
        const stepSeconds = 60 / tempo / 4;
        const progress = (engine.ctx.currentTime - startedAt.current) / stepSeconds;
        const step = stepForHit(progress, q);
        engine.setStep(step, pad, velocity);
        setPattern((prev) => {
          const next = [...prev];
          next[step * PADS + pad] = velocity;
          return next;
        });
      }
    },
    [ensure, flash, mobile]
  );

  const onPadDown = (pad: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    // pointerdown, not click: a pad should answer the moment it is touched,
    // and two fingers should make two sounds.
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    void hit(pad, velocityFromPoint(e.clientY - rect.top, rect.height));
    setSelected(pad);
    engineRef.current?.requestWave(pad);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // A select takes letters too (type-ahead), so it keeps them.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable)
        return;
      // Only when this window is the focused one.
      if (!target?.closest?.(`#${CSS.escape(id)}`)) return;
      const pad = padForKeyEvent(e);
      if (pad >= 0) {
        e.preventDefault();
        void hit(pad, DEFAULT_VELOCITY);
        setSelected(pad);
        engineRef.current?.requestWave(pad);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hit, id]);

  // ------------------------------------------------------------ transport

  const commitTempo = (v: number) => {
    setBpm(v);
    engineRef.current?.setParam(PARAM.bpm, v);
  };

  const togglePlay = async () => {
    const engine = engineRef.current ?? (await ensure());
    if (!engine) return;
    const next = !playing;
    if (next) startedAt.current = engine.ctx.currentTime;
    engine.setParam(PARAM.playing, next ? 1 : 0);
    if (!next) {
      engine.allOff();
      const el = stepRefs.current[lastStep.current];
      if (el) delete el.dataset.play;
      lastStep.current = -1;
    }
    setPlaying(next);
    setSay(next ? "Playing" : "Stopped");
  };

  const toggleArm = () => {
    setArmed((a) => {
      setSay(a ? "Record off" : "Record armed, pads are written into the bar");
      return !a;
    });
  };

  const clearPattern = () => {
    engineRef.current?.clearPattern();
    setPattern(new Array(STEPS * PADS).fill(0));
    setSay("Pattern cleared");
  };

  const setStepVelocity = (step: number, pad: number, velocity: number) => {
    engineRef.current?.setStep(step, pad, velocity);
    setPattern((prev) => {
      const next = [...prev];
      next[step * PADS + pad] = velocity;
      return next;
    });
  };

  // ------------------------------------------------------------ recording

  const startSample = async () => {
    if (held.current) return;
    held.current = true;
    const pad = live.current.selected;
    const engine = engineRef.current ?? (await ensure());
    if (!engine || !held.current) return;
    try {
      await engine.openMic();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      held.current = false;
      setSay(
        // Let go while the browser was still asking. The stream it granted
        // has already been stopped; the next hold records straight away.
        name === "AbortError"
          ? "Microphone ready. Hold Sample while you make the sound."
          : name === "NotAllowedError"
            ? "Microphone access was declined. Allow it in the browser's site settings to sample."
            : "No microphone was available."
      );
      return;
    }
    if (!held.current) {
      engine.releaseMic();
      return;
    }
    takePad.current = pad;
    engine.startRecording(pad);
    setSampling(true);
    setSay(`Recording into pad ${pad + 1}`);
  };

  const stopSample = () => {
    if (!held.current && takePad.current < 0) return;
    endTake(true);
  };

  // --------------------------------------------------------------- volume

  const applyVolume = (nextLevel: number, nextMuted: boolean) => {
    setVolume({ level: nextLevel, muted: nextMuted });
    writeVolume(nextLevel, nextMuted);
    engineRef.current?.setParam(PARAM.master, gainFor(nextLevel, nextMuted));
  };

  // -------------------------------------------------------------- presets

  const applyPreset = async (name: string) => {
    setPreset(name);
    const found = PRESETS.find((p) => p.name === name);
    if (!found) return;
    const engine = engineRef.current ?? (await ensure());
    if (!engine) return;

    engine.clearPattern();
    const next = new Array(STEPS * PADS).fill(0);
    for (const [step, pad, velocity] of presetSteps(found)) {
      engine.setStep(step, pad, velocity);
      next[step * PADS + pad] = velocity;
    }
    setPattern(next);
    setBpm(found.bpm);
    engine.setParam(PARAM.bpm, found.bpm);
    setSwing(found.swing);
    engine.setParam(PARAM.swing, found.swing);
    setVintage(!!found.vintage);
    engine.setParam(PARAM.vintage, found.vintage ? 1 : 0);
    setVinyl(!!found.vinyl);
    engine.setParam(PARAM.vinyl, found.vinyl ? 1 : 0);

    // Straight into playing: a preset that needs a second button press is
    // not a preset.
    startedAt.current = engine.ctx.currentTime;
    engine.setParam(PARAM.playing, 1);
    setPlaying(true);
    setSay(`${found.name}, ${found.bpm} BPM`);
  };

  // ---------------------------------------------------------- your own audio

  const loadInto = async (pad: number, file: File) => {
    const engine = engineRef.current ?? (await ensure());
    if (!engine) return;
    try {
      const { seconds } = await engine.loadFile(pad, file);
      setSelected(pad);
      const limit = secondsLabel(engine.padSeconds);
      const capped = seconds > engine.padSeconds;
      setSay(
        `${file.name} on pad ${pad + 1}` +
          (capped ? `, first ${limit} seconds` : "")
      );
    } catch (err) {
      setSay(
        err instanceof FileTooLargeError
          ? `${file.name} is too large. Pads hold ${secondsLabel(engine.padSeconds)} seconds, so trim it to a short clip first.`
          : `${file.name} could not be decoded. Try a WAV, MP3 or M4A.`
      );
    }
  };

  // --------------------------------------------------------------- export

  const [exporting, setExporting] = useState(false);
  const exportLoop = async () => {
    const engine = engineRef.current;
    if (!engine || exporting) return;
    setExporting(true);
    try {
      const frames = loopFrames(bpm, engine.sampleRate);
      const { samples, rate } = await engine.bounce(frames);
      const wav = encodeWav(samples, rate);
      const name = loopFilename();
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      try {
        const fs = await getFsManager();
        if (!(await fs.getFolder(SAMPLES_DIR, "shallow"))) await fs.createFolder(SAMPLES_DIR);
        await fs.writeFile(`${SAMPLES_DIR}/${name}`, wav);
        setSay(`Saved ${name} to My Samples`);
      } catch {
        setSay(`Downloaded ${name}`);
      }
    } finally {
      setExporting(false);
    }
  };

  // A file the desktop opened us with: Explorer hands over a path, we put it
  // on pad 1 and say so. The other half of Export.
  const loadedOnce = useRef(false);
  useEffect(() => {
    if (!openWith || loadedOnce.current) return;
    loadedOnce.current = true;
    void (async () => {
      const engine = engineRef.current ?? (await ensure());
      if (!engine) return;
      const name = openWith.split("/").pop() ?? "sample";
      try {
        const fs = await getFsManager();
        const bytes = await fs.readBytes(openWith);
        if (!bytes) throw new Error("missing");
        await engine.loadAudio(0, bytes);
        setSelected(0);
        setSay(`${name} on pad 1`);
      } catch (err) {
        setSay(
          err instanceof FileTooLargeError
            ? `${name} is too large for a pad. Pads hold ${secondsLabel(engine.padSeconds)} seconds.`
            : `${name} could not be opened.`
        );
      }
    })();
  }, [openWith, ensure]);

  // ----------------------------------------------------------- waveform

  useEffect(() => {
    const canvas = waveRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const peaks = wave?.peaks;
    if (!peaks || !wave || wave.len === 0) {
      ctx.fillStyle = "#00ff66";
      ctx.fillRect(0, Math.floor(h / 2), w, 1);
      return;
    }
    ctx.fillStyle = "#00ff66";
    const bar = w / peaks.length;
    for (let i = 0; i < peaks.length; i++) {
      const height = Math.max(1, peaks[i] * (h - 2));
      ctx.fillRect(i * bar, (h - height) / 2, Math.max(1, bar - 1), height);
    }
  }, [wave]);

  useEffect(() => {
    engineRef.current?.requestWave(selected);
  }, [selected]);

  // ----------------------------------------------------------------- view

  const padName = (pad: number) => names[pad] ?? `pad ${pad + 1}`;
  const rows = [0, 1, 2, 3];
  const cols = [0, 1, 2, 3];

  if (phase === "blocked") {
    return (
      <div className={styles.root}>
        <div className={styles.blocked}>
          This browser cannot run the sampler: it needs AudioWorklet and
          WebAssembly. Everything else on the desktop still works.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.transport}>
        <button
          type="button"
          onClick={togglePlay}
          className={styles.transportBtn}
          data-on={playing ? "" : undefined}
        >
          {/* The words are the action, so there is no aria-pressed on top:
              "Stop, pressed" says the same thing twice and contradicts itself. */}
          {playing ? "Stop" : "Play"}
        </button>
        <button
          type="button"
          onClick={toggleArm}
          className={styles.recBtn}
          data-on={armed ? "" : undefined}
          aria-pressed={armed}
          aria-label="Rec, record pads into the bar"
        >
          <span className={styles.recDot} aria-hidden="true" /> Rec
        </button>
        <div className={`field-row ${styles.check}`}>
          <input
            id={`${uid}-quantize`}
            type="checkbox"
            checked={quantize}
            onChange={(e) => setQuantize(e.target.checked)}
          />
          <label htmlFor={`${uid}-quantize`}>Quantize</label>
        </div>
        <label className={styles.field}>
          Tempo
          <input
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={tempoDraft ?? bpm}
            onChange={(e) => {
              setTempoDraft(e.target.value);
              const v = Number(e.target.value);
              if (v >= MIN_BPM && v <= MAX_BPM) commitTempo(v);
            }}
            onBlur={() => {
              if (tempoDraft === null) return;
              const v = Number(tempoDraft);
              commitTempo(Number.isFinite(v) && tempoDraft !== "" ? clampBpm(v) : bpm);
              setTempoDraft(null);
            }}
          />
        </label>
        <label className={styles.field}>
          Swing
          <input
            type="range"
            min={0}
            max={75}
            value={Math.round(swing * 100)}
            aria-valuetext={swing > 0 ? `${Math.round(swing * 100)} percent swing` : "Straight, no swing"}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setSwing(v);
              engineRef.current?.setParam(PARAM.swing, v);
            }}
          />
        </label>
        <label className={styles.field}>
          Preset
          <select
            value={preset}
            onChange={(e) => void applyPreset(e.target.value)}
          >
            <option value="">choose</option>
            {PRESETS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {/* Output: mute, level, meter. Kept together as one cluster so it
            wraps as a unit on a phone instead of scattering. */}
        <div className={styles.output}>
          <button
            type="button"
            className={styles.mute}
            onClick={() => applyVolume(level, !muted)}
            aria-pressed={muted}
            // Fixed name, state in aria-pressed: "Mute, pressed" is muted.
            aria-label="Mute"
            title={muted ? "Unmute" : "Mute"}
          >
            <Speaker muted={muted} />
          </button>
          <input
            type="range"
            className={styles.volume}
            min={0}
            max={100}
            step={1}
            value={level}
            onChange={(e) => applyVolume(Number(e.target.value), false)}
            aria-label="Volume"
            aria-valuetext={levelLabel(level, muted)}
          />
          <div className={styles.meterWrap} aria-hidden="true">
            <div ref={meterRef} className={styles.meter} />
          </div>
        </div>
      </div>

      <div className={styles.grid} role="group" aria-label="Pads">
        {rows.map((rowFromTop) =>
          cols.map((col) => {
            const pad = padAtGrid(rowFromTop, col);
            return (
              <button
                key={pad}
                ref={(el) => {
                  padRefs.current[pad] = el;
                }}
                type="button"
                className={styles.pad}
                data-selected={selected === pad ? "" : undefined}
                onPointerDown={onPadDown(pad)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropPad(pad);
                }}
                onDragLeave={() => setDropPad((p) => (p === pad ? -1 : p))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropPad(-1);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void loadInto(pad, file);
                }}
                data-drop={dropPad === pad ? "" : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void hit(pad, DEFAULT_VELOCITY);
                    setSelected(pad);
                  }
                }}
                // Screen readers in browse mode and voice control send a
                // bare click with no pointer and no key before it (detail
                // 0). Real presses already fired on pointerdown or keydown.
                onClick={(e) => {
                  if (e.detail !== 0) return;
                  void hit(pad, DEFAULT_VELOCITY);
                  setSelected(pad);
                  engineRef.current?.requestWave(pad);
                }}
                aria-label={`Pad ${pad + 1}, ${padName(pad)}${
                  recorded[pad] ? ", sampled" : ""
                }${selected === pad ? ", selected" : ""}, key ${keyForPad(pad)}`}
              >
                <span className={styles.padKey} aria-hidden="true">
                  {keyForPad(pad)}
                </span>
                <span className={styles.padName} aria-hidden="true">
                  {padName(pad)}
                </span>
                {recorded[pad] && <span className={styles.padDot} aria-hidden="true" />}
              </button>
            );
          })
        )}
      </div>

      <div className={styles.side}>
        <div className={styles.sideTitle}>
          {selected + 1} · {padName(selected)}
        </div>
        <canvas
          ref={waveRef}
          className={styles.wave}
          role="img"
          aria-label={`Waveform of pad ${selected + 1}`}
        />
        <div className={styles.sideRow}>
          <button
            type="button"
            className={styles.sampleBtn}
            data-on={sampling ? "" : undefined}
            onPointerDown={(e) => {
              e.preventDefault();
              void startSample();
            }}
            onPointerUp={stopSample}
            onPointerLeave={stopSample}
            onPointerCancel={stopSample}
            // Hold Space or Enter, the keyboard's version of holding it down.
            onKeyDown={(e) => {
              if (e.key !== " " && e.key !== "Enter") return;
              e.preventDefault();
              if (!e.repeat) void startSample();
            }}
            onKeyUp={(e) => {
              if (e.key !== " " && e.key !== "Enter") return;
              e.preventDefault();
              stopSample();
            }}
            onBlur={stopSample}
            aria-label={
              sampling
                ? `Recording into pad ${selected + 1}, let go to stop`
                : `Sample, hold to record into pad ${selected + 1} from the microphone`
            }
          >
            {sampling ? "Recording" : "Sample"}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={`Load an audio file into pad ${selected + 1}`}
          >
            Load
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadInto(selected, file);
              e.target.value = "";
            }}
          />
        </div>
        <div className={`${styles.sideRow} ${styles.tipRow}`}>
          <ToggleTip
            id={`${uid}-vintage`}
            label="12-bit"
            checked={vintage}
            onChange={(on) => {
              setVintage(on);
              engineRef.current?.setParam(PARAM.vintage, on ? 1 : 0);
            }}
            tip="Plays through a late-80s sampler: 12-bit steps and a lower sample rate, for grit and softer highs."
          />
          <ToggleTip
            id={`${uid}-vinyl`}
            label="Vinyl"
            checked={vinyl}
            onChange={(on) => {
              setVinyl(on);
              engineRef.current?.setParam(PARAM.vinyl, on ? 1 : 0);
            }}
            tip="Adds record hiss, the odd crackle and a little warmth, as if the loop were playing off a record."
          />
        </div>
        <div className={styles.sideRow}>
          <button type="button" onClick={clearPattern}>
            Clear
          </button>
          <button type="button" onClick={exportLoop} disabled={exporting || phase !== "on"}>
            {exporting ? "Saving" : "Export"}
          </button>
        </div>
      </div>

      <div className={styles.steps} role="group" aria-label={`Steps for pad ${selected + 1}`}>
        {Array.from({ length: STEPS }, (_, step) => {
          const on = pattern[step * PADS + selected] > 0;
          return (
            <button
              key={step}
              ref={(el) => {
                stepRefs.current[step] = el;
              }}
              type="button"
              className={styles.step}
              data-on={on ? "" : undefined}
              data-beat={step % 4 === 0 ? "" : undefined}
              aria-pressed={on}
              aria-label={`Step ${step + 1}`}
              onClick={() => setStepVelocity(step, selected, on ? 0 : DEFAULT_VELOCITY)}
            >
              <span aria-hidden="true">{step + 1}</span>
            </button>
          );
        })}
      </div>

      <p className={styles.footer}>
        {phase === "starting"
          ? "Starting the audio engine..."
          : phase === "off"
            ? "Tap a pad to start. Nothing is recorded until you hold Sample."
            : sampling
              ? `Recording into pad ${selected + 1}. Let go to keep it.`
              : "Pick a preset, or drop your own audio on a pad. Nothing leaves your browser."}
      </p>
      <span role="status" aria-live="polite" className={styles.sr}>
        {say}
      </span>
    </div>
  );
}

// A toggle with a Win98 tooltip saying what it does. Hover shows it on a
// pointer, keyboard focus shows it too, and the "?" shows it on a phone,
// where nothing hovers. The text is the checkbox's description either
// way, so a screen reader hears it with the toggle.
function ToggleTip({
  id,
  label,
  checked,
  onChange,
  tip,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  tip: string;
}) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!hostRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Capture, and spent here: Escape would otherwise also close the window.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc, true);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open]);
  const tipId = `${id}-tip`;
  return (
    <div
      ref={hostRef}
      className={`field-row ${styles.check} ${styles.tipHost}`}
      data-open={open ? "" : undefined}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={tipId}
      />
      <label htmlFor={id}>{label}</label>
      <button
        type="button"
        className={styles.tipButton}
        aria-label={`What ${label} does`}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      <span id={tipId} role="tooltip" className={styles.tip}>
        <strong>{label}</strong> {tip}
      </span>
    </div>
  );
}

