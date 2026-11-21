"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { windowAtomFamily } from "@/state/window";
import { getFsManager } from "@/state/fsManager";
import { useMotionAllowed } from "@/lib/useMotionAllowed";
import { applyEffect, EFFECTS, frameSize, snapFilename, type Effect } from "@/lib/camera/effects";
import { LatticeLoader } from "../fx/LatticeLoader";
import styles from "./Camera.module.css";

// A 1998 webcam. The feed is drawn small and scaled up with pixelated
// rendering, through one of four period effects, or through "Glass", the
// one modern one (lib/camera/effects.ts). Every effect is in the pixels,
// so a saved picture is the one on screen.
//
// The camera runs in the browser only. Nothing is uploaded, nothing is
// kept unless you press Snap and then Save. The stream is asked for on
// the button, never on open, and stops when the window closes, is
// minimised, or the tab is hidden.

const PICTURES_DIR = "/user/My Pictures";
// A snap is drawn at twice the preview's size. Glass is smooth, so the
// extra pixels are real detail; the blocky effects gain nothing from them.
const SNAP_SCALE = { glass: 2, pixel: 1 };
// A saved picture is scaled up with hard edges first. At 160x120 a phone's
// photo viewer smoothed it to full screen, which blends a dither back into
// something close to the plain photo: the effect seemed not to be saved.
const SAVE_SCALE = 8;

/** Draw the current video frame, cover-fit to 4:3, through an effect. */
function renderFrame(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effect: Effect
) {
  const vw = video.videoWidth || 4;
  const vh = video.videoHeight || 3;
  const scale = Math.max(width / vw, height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
  const frame = ctx.getImageData(0, 0, width, height);
  applyEffect(effect, frame.data, width, height);
  ctx.putImageData(frame, 0, 0);
}

type Phase = "off" | "starting" | "on";

export function Camera({ id }: { id: string }) {
  const win = useAtomValue(windowAtomFamily(id));
  const motion = useMotionAllowed();
  const idBase = `cam-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const effectRef = useRef<Effect>("colours");
  const [phase, setPhase] = useState<Phase>("off");
  const [effect, setEffect] = useState<Effect>("colours");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  // The effect the current snap was taken with, or null before the first.
  const [snapped, setSnapped] = useState<Effect | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // The draw loop reads the effect through a ref so changing it does not
  // restart the loop.
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  // Bumped by every stop. A start that was still waiting on the permission
  // prompt when the window was minimised, hidden or closed sees the change
  // and stops the stream it was handed, instead of switching the camera on
  // in a window nobody is looking at.
  const generation = useRef(0);

  const stop = useCallback(() => {
    generation.current++;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("off");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setSaved(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no camera API.");
      return;
    }
    setPhase("starting");
    const mine = generation.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (generation.current !== mine) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (generation.current !== mine) return;
      setPhase("on");
    } catch (e) {
      if (generation.current !== mine) return;
      // play() can reject after the stream is live: without this the light
      // stays on under a "Turn on camera" button, and pressing it opens a
      // second stream on top of the first.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera access was declined. You can allow it in the browser's site settings and try again."
          : name === "NotFoundError"
            ? "No camera found on this device."
            : "The camera could not be started."
      );
      setPhase("off");
    }
  }, []);

  // Draw loop: video -> small frame -> effect -> visible canvas.
  useEffect(() => {
    if (phase !== "on") return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!video || !canvas || !ctx) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (video.readyState < 2) return;
      const effect = effectRef.current;
      const { width, height } = frameSize(effect);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      renderFrame(video, ctx, width, height, effect);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // The stream ends with the window, when it is minimised, and when the
  // tab is hidden. It never restarts on its own.
  useEffect(() => () => stop(), [stop]);
  // Minimised: the tracks end at once; the phase follows on the next
  // tick so this effect does not set state synchronously.
  const minimized = win.status === "minimized";
  useEffect(() => {
    if (!minimized) return;
    const t = setTimeout(stop, 0);
    return () => clearTimeout(t);
  }, [minimized, stop]);
  useEffect(() => {
    const onHide = () => document.hidden && stop();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stop]);

  const snap = () => {
    const video = videoRef.current;
    const dst = snapRef.current;
    const ctx = dst?.getContext("2d", { willReadFrequently: true });
    if (!video || !dst || !ctx || video.readyState < 2) return;
    // The frame on screen, drawn again through the same effect at snap
    // size. The preview is mirrored so it behaves like a mirror; the
    // picture is not, so it reads like a photo.
    const effect = effectRef.current;
    const { width, height } = frameSize(effect);
    const k = effect === "glass" ? SNAP_SCALE.glass : SNAP_SCALE.pixel;
    dst.width = width * k;
    dst.height = height * k;
    renderFrame(video, ctx, dst.width, dst.height, effect);
    setSnapped(effect);
    setSaved(null);
    if (motion) {
      setFlash(true);
      setTimeout(() => setFlash(false), 140);
    }
  };

  const save = async () => {
    const snap = snapRef.current;
    if (!snap || !snapped) return;
    const name = snapFilename();
    let out = snap;
    if (snapped !== "glass") {
      out = document.createElement("canvas");
      out.width = snap.width * SAVE_SCALE;
      out.height = snap.height * SAVE_SCALE;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(snap, 0, 0, out.width, out.height);
    }
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/png"));
    if (!blob) return;
    // Two copies: a real download, and one in the site's own filesystem
    // so it shows up in Explorer under My Pictures.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try {
      const fs = await getFsManager();
      if (!(await fs.getFolder(PICTURES_DIR, "shallow"))) await fs.createFolder(PICTURES_DIR);
      await fs.writeFile(`${PICTURES_DIR}/${name}`, await blob.arrayBuffer());
      setSaved(`Saved ${name} to My Pictures.`);
    } catch {
      setSaved(`Downloaded ${name}.`);
    }
  };

  const glass = effect === "glass";

  return (
    <div className={styles.root}>
      <div className={styles.finder} aria-live="polite">
        <video ref={videoRef} className={styles.video} playsInline muted aria-hidden="true" />
        <canvas
          ref={canvasRef}
          width={160}
          height={120}
          className={styles.canvas}
          data-glass={glass ? "" : undefined}
          hidden={phase !== "on"}
          aria-label="Camera preview"
          role="img"
        />
        {phase === "starting" && (
          // Covers the browser's permission prompt too, which can sit
          // for as long as the visitor likes, so no timer: a count
          // running up while they read the prompt would feel like a
          // countdown.
          <LatticeLoader
            label="Waiting for the camera"
            color="#c0c0c0"
            showTimer={false}
            className={styles.loader}
          />
        )}
        {phase === "off" && (
          <div className={styles.notice}>{error ?? "The camera is off."}</div>
        )}
        {flash && <div className={styles.flash} aria-hidden="true" />}
      </div>

      <p className={styles.privacy}>Runs in your browser only. Nothing is uploaded or stored.</p>

      <fieldset className={styles.effects}>
        <legend>Effect</legend>
        <div className={styles.radios}>
          {EFFECTS.map((e) => (
            <div className="field-row" key={e.id}>
              <input
                type="radio"
                id={`${idBase}-${e.id}`}
                name={`${idBase}-effect`}
                checked={effect === e.id}
                onChange={() => setEffect(e.id)}
              />
              <label htmlFor={`${idBase}-${e.id}`}>{e.label}</label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className={styles.actions}>
        {phase === "on" ? (
          <button type="button" onClick={stop}>
            Turn off
          </button>
        ) : (
          <button type="button" onClick={start} disabled={phase === "starting"}>
            Turn on camera
          </button>
        )}
        <button type="button" onClick={snap} disabled={phase !== "on"}>
          Snap
        </button>
        <button type="button" onClick={save} disabled={!snapped}>
          Save picture
        </button>
      </div>
      {/* Always mounted: the snapshot lives in this canvas, and a fresh
          element on first Snap would have nothing on it. */}
      {/* Always in the DOM: a live region that appears together with its
          first message is often not announced, so the first Snap was silent. */}
      <div className={styles.snapRow} data-empty={snapped ? undefined : ""}>
        <canvas
          ref={snapRef}
          className={styles.snap}
          data-glass={snapped === "glass" ? "" : undefined}
          aria-label="Snapped picture"
          role="img"
          hidden={!snapped}
        />
        <span role="status" className={styles.saved}>
          {snapped ? (saved ?? "Snapped. Save it or take another.") : ""}
        </span>
      </div>
    </div>
  );
}
