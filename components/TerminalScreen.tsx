"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMotionAllowed } from "@/lib/useMotionAllowed";
import styles from "./TerminalScreen.module.css";

// The "broken display" layer: character noise behind the text, the
// headline bending like a CRT under magnetic pull, the other lines
// decoding in. All three load on demand (never on "/"), and none of them
// mount under prefers-reduced-motion, where the page is exactly the plain
// version. The real text stays in the DOM in every case.
const TerminalGlitch = dynamic(
  () => import("@/components/fx/TerminalGlitch").then((m) => m.TerminalGlitch),
  { ssr: false }
);
const WarpText = dynamic(
  () => import("@/components/fx/WarpText").then((m) => m.WarpText),
  { ssr: false }
);
const DecodeText = dynamic(
  () => import("@/components/fx/DecodeText").then((m) => m.DecodeText),
  { ssr: false }
);

// Same values as the .green / .amber tokens in the stylesheet. Canvas and
// WebGL cannot read CSS variables, so they are repeated here on purpose.
const PALETTE = {
  green: { fg: "#33ff66", prompt: "#5eff8e", glow: "rgba(51,255,102,0.75)", noise: ["#0b2214", "#156b31", "#1fa347"] },
  amber: { fg: "#ff6b4a", prompt: "#ffb3a0", glow: "rgba(255,107,74,0.75)", noise: ["#2a1510", "#7a3322", "#b04a32"] },
} as const;

// Matches .l1 .. .l6 in the stylesheet, in seconds, so a line's decode
// starts when its fade-in does.
const LINE_DELAYS = [0.12, 0.64, 1.1, 1.5, 1.9, 2.2];

const TERMINAL_FONT =
  '"Fira Code", "JetBrains Mono", "Menlo", "Consolas", "Lucida Console", monospace';

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
  | { kind: "button"; label: string; onClick: () => void; primary?: boolean }
  /** Submit button wired to a server action — used by /login, where
   * redirect() only auto-dispatches from a form's action (see the
   * server-actions note in CLAUDE.md). */
  | {
      kind: "submit";
      label: string;
      action: (formData: FormData) => void | Promise<void>;
      primary?: boolean;
    };

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

  // Effects are a client-only decision: reduced motion is only knowable in
  // the browser, and the server-rendered page must be the plain one.
  const fx = useMotionAllowed();
  const palette = PALETTE[variant];
  const headline = lines[0];

  return (
    <div className={`${styles.root} ${styles[variant]}`}>
      {fx && <TerminalGlitch colors={[...palette.noise]} />}
      <div className={styles.scanlines} aria-hidden="true" />
      <main className={styles.terminal}>
        {fx && headline && (
          <div className={`${styles.headline} ${styles.line} ${lineDelayClass(0)}`}>
            <WarpText
              segments={[
                ...(headline.prefix ? [{ text: `${headline.prefix} `, color: palette.prompt }] : []),
                { text: headline.text, color: palette.fg },
              ]}
              fontFamily={TERMINAL_FONT}
              fontSize={30}
              fontWeight={700}
              letterSpacing={0.5}
              glow={palette.glow}
              warpStrength={0.05}
              warpScale={1.4}
              speed={0.4}
              pointerInfluence={0.5}
              pointerStrength={0.3}
              refraction={0.014}
              ripple
              style={{ height: 46 }}
            />
          </div>
        )}
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
            // With effects on, the warped headline above is the visible
            // one; the h1 stays for the document outline and readers.
            return (
              <h1
                key={i}
                className={fx ? styles.srOnly : className}
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
              {fx ? (
                <DecodeText
                  text={line.text}
                  mode="reveal"
                  delay={LINE_DELAYS[Math.min(i, LINE_DELAYS.length - 1)]}
                  duration={0.7}
                />
              ) : (
                <span>{line.text}</span>
              )}
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
            if (action.kind === "submit") {
              // display:contents so the form wrapper doesn't break the
              // .actions flex row.
              return (
                <form key={i} action={action.action} style={{ display: "contents" }}>
                  <button type="submit" className={cls}>
                    {action.label}
                  </button>
                </form>
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
