"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./CallChip.module.css";

// A chip in the chat log while Fix & Iterate has a request out: the tool
// name, what it is working on, a progress wash that creeps to 90% and
// holds, and a timer. It rolls to a check when the reply lands, or shakes
// and offers Retry when it does not.
//
// Ported from React Bits' CallChip (github.com/DavidHDev/react-bits, MIT +
// Commons Clause). The icon set is replaced with three inline pixel
// glyphs so no icon package is pulled in, the chip is squared off with a
// Win98 bevel, and the timer writes to the DOM directly rather than
// rerendering the log ten times a second.

export type CallChipStatus = "running" | "done" | "error";
type Glyph = "tool" | "check" | "retry";

const HOLD_AT = 0.9;
const SHAKE = [0, -1, 1, -0.66, 0.66, -0.33, 0];
const WORDS: Record<CallChipStatus, string> = {
  running: "running",
  done: "done",
  error: "failed",
};

const fmt = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const reduceMotion = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
const glyphOf = (s: CallChipStatus): Glyph =>
  s === "done" ? "check" : s === "error" ? "retry" : "tool";

// 11x11 pixel glyphs, drawn as rects so they stay crisp at any size.
function Pixels({ rows }: { rows: string[] }) {
  return (
    <svg viewBox="0 0 11 11" width="1em" height="1em" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        Array.from(row).map((c, x) =>
          c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null
        )
      )}
    </svg>
  );
}
const PENCIL = [
  "........##.",
  ".......####",
  "......####.",
  ".....####..",
  "....####...",
  "...####....",
  "..####.....",
  ".####......",
  "###........",
  "##.........",
  "...........",
];
const CHECK = [
  "...........",
  "..........#",
  ".........##",
  "........##.",
  ".......##..",
  "#.....##...",
  "##...##....",
  ".##.##.....",
  "..###......",
  "...#.......",
  "...........",
];
const RETRY = [
  "...........",
  "...#####...",
  "..##...##..",
  ".##.....##.",
  ".##....####",
  "........###",
  ".......####",
  ".##....#...",
  "..##...#...",
  "...#####...",
  "...........",
];

export function CallChip({
  name = "edit",
  argument = "",
  status = "running",
  expectedMs = 6000,
  onRetry,
  className,
  style,
}: {
  name?: string;
  argument?: string;
  status?: CallChipStatus;
  /** How long the wash takes to reach its 90% hold. */
  expectedMs?: number;
  onRetry?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const fraction = useRef(0);
  const clock = useRef(0);
  const shakeAnim = useRef<Animation | null>(null);
  const srRef = useRef<HTMLSpanElement>(null);
  const [pressed, setPressed] = useState(false);
  // Which glyph is in and which is rolling out; adjusted during render
  // when the status changes so both transitions start on the same frame.
  const [roll, setRoll] = useState<{ cur: Glyph; prev: Glyph | null }>({
    cur: glyphOf(status),
    prev: null,
  });
  if (glyphOf(status) !== roll.cur) setRoll({ cur: glyphOf(status), prev: roll.cur });

  const setFraction = (f: number, instant: boolean) => {
    const fill = fillRef.current;
    if (!fill) return;
    fraction.current = f;
    if (instant) fill.style.transition = "none";
    fill.style.transform = `scaleX(${f})`;
    if (instant) {
      void fill.getBoundingClientRect();
      fill.style.transition = "";
    }
  };

  useLayoutEffect(() => {
    if (status === "running") {
      shakeAnim.current?.cancel();
      setFraction(0, true);
      setFraction(HOLD_AT, false);
    } else if (status === "done") {
      setFraction(1, false);
    } else {
      // Freeze the wash where it is and shake, unless motion is off.
      const fill = fillRef.current;
      const live = fill ? new DOMMatrix(getComputedStyle(fill).transform).a : fraction.current;
      setFraction(Math.min(1, Math.max(0, live)), true);
      if (!reduceMotion() && rootRef.current) {
        shakeAnim.current = rootRef.current.animate(
          SHAKE.map((k) => ({ transform: `translateX(${k * 6}px)`, easing: "cubic-bezier(0.77, 0, 0.175, 1)" })),
          { duration: 450, composite: "add" }
        );
      }
    }
    return () => shakeAnim.current?.cancel();
  }, [status]);

  // Enter transitions arm after the first paint, so the chip does not
  // slide its glyph in on mount.
  useEffect(() => {
    rootRef.current?.setAttribute("data-mounted", "");
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const startedAt = performance.now();
    const write = () => {
      clock.current = performance.now() - startedAt;
      if (timerRef.current) timerRef.current.textContent = fmt(clock.current);
    };
    write();
    const id = setInterval(write, 100);
    return () => {
      clearInterval(id);
      write();
    };
  }, [status]);

  // The live region is written by hand: it needs the clock at the moment
  // the status changed, and nothing else in the chip rerenders for it.
  useEffect(() => {
    const ms = Math.round(clock.current);
    const when = status === "done" && ms ? ` in ${fmt(ms)}` : status === "error" && ms ? ` after ${fmt(ms)}` : "";
    if (srRef.current) srRef.current.textContent = `${name} ${argument}, ${WORDS[status]}${when}`;
  }, [status, name, argument]);

  const glyphState = (g: Glyph) =>
    g === roll.cur ? "in" : g === roll.prev ? "out" : undefined;

  return (
    <span
      ref={rootRef}
      role="status"
      aria-busy={status === "running" || undefined}
      data-status={status}
      data-pressed={pressed ? "" : undefined}
      className={[styles.chip, className ?? ""].join(" ")}
      style={{ ...style, "--cc-expected": `${expectedMs}ms` } as CSSProperties}
    >
      <span ref={fillRef} className={styles.fill} aria-hidden="true" />
      <span className={styles.slot} aria-hidden="true">
        <span className={styles.glyph} data-state={glyphState("tool")}>
          <Pixels rows={PENCIL} />
        </span>
        <span className={styles.glyph} data-state={glyphState("check")}>
          <Pixels rows={CHECK} />
        </span>
        <span className={styles.glyph} data-state={glyphState("retry")}>
          <Pixels rows={RETRY} />
        </span>
      </span>
      <span className={styles.name} aria-hidden="true">
        {status === "error" ? "retry" : name}
      </span>
      {argument && (
        <span className={styles.arg} aria-hidden="true">
          {argument}
        </span>
      )}
      <span ref={timerRef} className={styles.timer} aria-hidden="true">
        0 ms
      </span>
      {status === "error" && onRetry && (
        <button
          type="button"
          className={styles.retry}
          aria-label={`Retry ${name} ${argument}`.trim()}
          onClick={onRetry}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
        />
      )}
      <span ref={srRef} className={styles.sr} />
    </span>
  );
}
