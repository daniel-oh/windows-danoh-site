"use client";

import Link from "next/link";
import styles from "./TerminalScreen.module.css";

// Shared retro-terminal screen powering /logout (green phosphor),
// /error (amber fault), and the segment-level app/error.tsx (amber).
// "use client" because app/error.tsx passes a reset() callback into a
// button action — function props can't cross the server/client
// boundary, so the component itself has to live on the client side.
// Server callers (/logout, /error) still pre-render the HTML; they
// just hydrate the component for any interactive bits.
// Each consumer declares its lines + actions; this component owns the
// HTML structure, the staggered reveal timing, the scanline overlay,
// and the reduced-motion bypass.
//
// Variant just toggles the CSS palette via a modifier class on .root —
// see TerminalScreen.module.css for the colour tokens. The first line
// in `lines` is rendered as <h1> for a real document outline; later
// lines are <div>s.

export type TerminalLine = {
  /** "$", "!", ">"  — a 1-char prefix shown before the text. */
  prefix?: string;
  /** "prompt" → bright (used for $/!); "angle" → dim (used for >). */
  prefixStyle?: "prompt" | "angle";
  /** Body of the line. */
  text: string;
  /** Append a blinking _ at the end. Typically only the last line. */
  cursor?: boolean;
};

export type TerminalAction =
  | { kind: "link"; label: string; href: string; primary?: boolean }
  | { kind: "button"; label: string; onClick: () => void; primary?: boolean };

export function TerminalScreen({
  variant,
  lines,
  actions,
  signature,
}: {
  variant: "green" | "amber";
  lines: TerminalLine[];
  actions: TerminalAction[];
  signature?: string;
}) {
  // Stagger delay class per index — the CSS module only ships 6 named
  // delays (.l1 .. .l6); past that we fall back to no extra delay so
  // the page still renders, just without further sequencing.
  const lineDelayClass = (i: number): string => {
    const k = i + 1;
    if (k <= 6) return styles[`l${k}` as `l${1 | 2 | 3 | 4 | 5 | 6}`] ?? "";
    return "";
  };
  // Actions and signature reuse later delay slots so the sequence
  // continues past the lines.
  const actionsDelayClass = lineDelayClass(lines.length);
  const signatureDelayClass = lineDelayClass(lines.length + 1);

  return (
    <div className={`${styles.root} ${styles[variant]}`}>
      <div className={styles.scanlines} aria-hidden="true" />
      <main className={styles.terminal}>
        {lines.map((line, i) => {
          const className = `${styles.line} ${lineDelayClass(i)}`;
          const prefix = line.prefix ? (
            <>
              <span
                className={
                  line.prefixStyle === "angle" ? styles.angle : styles.prompt
                }
              >
                {line.prefix}
              </span>{" "}
            </>
          ) : null;
          const cursor = line.cursor ? (
            <span className={styles.cursor} aria-hidden="true">
              _
            </span>
          ) : null;
          // First line is the headline — rendered as <h1> for the
          // document outline. Subsequent lines are plain <div>s.
          if (i === 0) {
            return (
              <h1
                key={i}
                className={className}
                style={{ font: "inherit", margin: 0 }}
              >
                {prefix}
                <span>{line.text}</span>
                {cursor}
              </h1>
            );
          }
          return (
            <div key={i} className={className}>
              {prefix}
              <span>{line.text}</span>
              {cursor}
            </div>
          );
        })}

        <div className={`${styles.actions} ${actionsDelayClass}`}>
          {actions.map((action, i) => {
            const cls = action.primary ? styles.primary : styles.secondary;
            if (action.kind === "link") {
              return (
                <Link key={i} href={action.href} className={cls}>
                  {action.label}
                </Link>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className={cls}
              >
                {action.label}
              </button>
            );
          })}
        </div>

        {signature && (
          <p className={`${styles.signature} ${signatureDelayClass}`}>
            {signature}
          </p>
        )}
      </main>
    </div>
  );
}
