"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./LatticeLoader.module.css";

// A 3x3 grid of dots that light up in orbit while something is working,
// then settle into a check or a cross. Shown on the glass while the AI
// writes a program.
//
// Ported from React Bits' LatticeLoader (github.com/DavidHDev/react-bits,
// MIT + Commons Clause), reduced to the one pattern this site uses. The
// timer writes straight to the DOM ten times a second so nothing rerenders
// around it; the screen reader gets the phase changes only, through the
// visually hidden status line.

export type LatticeStatus = "working" | "done" | "error";

// Cell order for the orbit: the ring index each cell lights on (null is the
// hole in the middle), and which cells draw the check and the cross.
const ORBIT: (number | null)[] = [0, 1, 2, 7, null, 3, 6, 5, 4];
const CHECK = [2, 3, 5, 7];
const CROSS = [0, 2, 4, 6, 8];
const STEP = 108; // ms per ring position
const CYCLE = STEP * 8;

const fmt = (ms: number) =>
  ms < 60_000
    ? `${(ms / 1000).toFixed(1)}s`
    : `${Math.floor(ms / 60_000)}m ${((ms % 60_000) / 1000).toFixed(1)}s`;
const spoken = (ms: number) =>
  ms < 60_000
    ? `${(ms / 1000).toFixed(1)} seconds`
    : `${Math.floor(ms / 60_000)} minutes ${((ms % 60_000) / 1000).toFixed(1)} seconds`;

export function LatticeLoader({
  label = "Thinking",
  doneLabel = "Done in",
  errorLabel = "Failed after",
  status = "working",
  color = "#000000",
  doneColor = "#000080",
  errorColor = "#800000",
  cellSize = 6,
  gap = 3,
  showTimer = true,
  className,
  style,
}: {
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  status?: LatticeStatus;
  color?: string;
  doneColor?: string;
  errorColor?: string;
  cellSize?: number;
  gap?: number;
  showTimer?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const timerRef = useRef<HTMLSpanElement>(null);
  const msRef = useRef(0);
  const srRef = useRef<HTMLSpanElement>(null);
  // The mark keeps its last shape while working so the fade-out does not
  // swap check for cross mid-transition.
  const [mark, setMark] = useState<"done" | "error">("done");
  if (status !== "working" && status !== mark) setMark(status);

  useEffect(() => {
    if (status !== "working") return;
    const startedAt = performance.now();
    const paint = () => {
      msRef.current = performance.now() - startedAt;
      if (timerRef.current) timerRef.current.textContent = fmt(msRef.current);
    };
    paint();
    const id = setInterval(paint, 100);
    return () => clearInterval(id);
  }, [status]);

  // The live region is written by hand so it can carry the elapsed time
  // at the moment the status changed without rerendering the grid.
  useEffect(() => {
    const sr = srRef.current;
    if (!sr) return;
    if (status === "working") {
      sr.textContent = `${label}, in progress`;
      return;
    }
    const when = showTimer ? ` ${spoken(msRef.current)}` : "";
    sr.textContent = `${status === "done" ? doneLabel : errorLabel}${when}`;
  }, [status, label, doneLabel, errorLabel, showTimer]);

  const vars = {
    ...style,
    "--ll-cell": `${cellSize}px`,
    "--ll-gap": `${gap}px`,
    "--ll-color": color,
    "--ll-mark": status === "error" ? errorColor : doneColor,
    "--ll-cycle": `${CYCLE}ms`,
  } as CSSProperties;
  const marks = mark === "error" ? CROSS : CHECK;

  return (
    <span
      role="status"
      className={[styles.root, className ?? ""].join(" ")}
      data-status={status}
      style={vars}
    >
      <span className={styles.grid} aria-hidden="true">
        <span className={[styles.layer, styles.run].join(" ")}>
          {ORBIT.map((unit, i) => (
            <span
              key={i}
              className={styles.cell}
              data-hole={unit == null ? "" : undefined}
              style={unit == null ? undefined : { animationDelay: `${unit * STEP}ms` }}
            />
          ))}
        </span>
        <span className={[styles.layer, styles.mark].join(" ")}>
          {ORBIT.map((_, i) => (
            <span key={i} className={styles.cell} data-on={marks.includes(i) ? "" : undefined} />
          ))}
        </span>
      </span>
      <span className={styles.label} aria-hidden="true">
        <span className={styles.text} data-active={status === "working" ? "" : undefined}>{label}</span>
        <span className={styles.text} data-active={status === "done" ? "" : undefined}>{doneLabel}</span>
        <span className={styles.text} data-active={status === "error" ? "" : undefined}>{errorLabel}</span>
      </span>
      {showTimer && (
        <span ref={timerRef} className={styles.timer} aria-hidden="true">
          0.0s
        </span>
      )}
      <span ref={srRef} className={styles.sr}>
        {label}, in progress
      </span>
    </span>
  );
}
