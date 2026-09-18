"use client";

import { useEffect, useRef } from "react";

// A field of flickering monospace characters, drawn on a canvas behind the
// terminal pages' text: corrupted sectors under "file not found".
//
// Ported from React Bits' LetterGlitch (github.com/DavidHDev/react-bits,
// MIT + Commons Clause) and reshaped for this site: palette comes from the
// terminal variant, the whole thing is drawn at low alpha so the copy on
// top keeps its AAA contrast, it pauses when the tab is hidden, resizes
// through a ResizeObserver rather than a window listener, and is aria-hidden
// (the real text is still in the DOM for readers). Nothing here runs under
// prefers-reduced-motion: the caller does not mount it.

type Rgb = { r: number; g: number; b: number };

const CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789";
const FONT_SIZE = 16;
const CHAR_W = 10;
const CHAR_H = 20;

function hexToRgb(hex: string): Rgb {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

export function TerminalGlitch({
  colors,
  /** ms between glitch passes; higher is calmer. */
  speed = 120,
  /** Overall opacity of the field. Keep low: text sits on top. */
  alpha = 0.22,
}: {
  colors: string[];
  speed?: number;
  alpha?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette = colors.map(hexToRgb);
    const chars = Array.from(CHARACTERS);
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

    type Letter = { char: string; rgb: Rgb; from: Rgb; to: Rgb; t: number };
    let letters: Letter[] = [];
    let columns = 0;
    let raf = 0;
    let last = 0;
    let width = 0;
    let height = 0;

    const layout = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(width / CHAR_W);
      const rows = Math.ceil(height / CHAR_H);
      letters = Array.from({ length: columns * rows }, () => {
        const rgb = pick(palette);
        return { char: pick(chars), rgb, from: rgb, to: pick(palette), t: 1 };
      });
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${FONT_SIZE}px "Fira Code", "JetBrains Mono", Menlo, Consolas, monospace`;
      ctx.textBaseline = "top";
      ctx.globalAlpha = alpha;
      for (let i = 0; i < letters.length; i++) {
        const l = letters[i];
        ctx.fillStyle = `rgb(${l.rgb.r},${l.rgb.g},${l.rgb.b})`;
        ctx.fillText(l.char, (i % columns) * CHAR_W, Math.floor(i / columns) * CHAR_H);
      }
    };

    const glitch = () => {
      // A few percent of the field changes per pass; each letter fades
      // from the colour it is showing, so re-picking one mid-fade continues
      // instead of snapping.
      const n = Math.max(1, Math.floor(letters.length * 0.04));
      for (let k = 0; k < n; k++) {
        const l = letters[Math.floor(Math.random() * letters.length)];
        if (!l) continue;
        l.char = pick(chars);
        l.from = l.rgb;
        l.to = pick(palette);
        l.t = 0;
      }
    };

    const frame = (now: number) => {
      if (now - last >= speed) {
        glitch();
        last = now;
      }
      let dirty = false;
      for (const l of letters) {
        if (l.t < 1) {
          l.t = Math.min(1, l.t + 0.05);
          l.rgb = {
            r: Math.round(l.from.r + (l.to.r - l.from.r) * l.t),
            g: Math.round(l.from.g + (l.to.g - l.from.g) * l.t),
            b: Math.round(l.from.b + (l.to.b - l.from.b) * l.t),
          };
          dirty = true;
        }
      }
      if (dirty) draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    layout();
    start();
    const ro = new ResizeObserver(layout);
    ro.observe(host);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [colors, speed, alpha]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}
      />
      {/* The middle stays black. The copy sits there, and the amber and
          green are 7:1 on black by design; any noise directly under the
          text would spend that. The field lives at the edges. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 62% 58% at 50% 50%, #000 0%, #000 42%, rgba(0,0,0,0.6) 72%, rgba(0,0,0,0) 100%)",
        }}
      />
    </>
  );
}
