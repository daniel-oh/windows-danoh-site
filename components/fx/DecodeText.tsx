"use client";

import { useEffect, useRef, type CSSProperties, type ElementType } from "react";

// Text that resolves out of character noise.
//
// Two modes:
//   reveal   the text scrambles in once when mounted, like a line being
//            decoded on a terminal. Used by the error pages.
//   pointer  letters near the pointer scramble and settle back as it passes.
//            Used as a small accent (the blog tagline).
//
// After React Bits' ScrambledText (github.com/DavidHDev/react-bits, MIT +
// Commons Clause), itself after Tom Miller's CodePen. Theirs uses GSAP's
// SplitText and ScrambleTextPlugin; this splits the characters itself and
// loads only ScrambleTextPlugin, on demand, the way the rest of this site
// loads GSAP (`import("gsap")`, never at the top level). The text is in the
// DOM verbatim before any script runs and is restored verbatim when the
// effect ends, so search engines and screen readers see the real sentence.
// The scrambling spans are aria-hidden behind a visually hidden copy.
//
// Nothing animates under prefers-reduced-motion or when the caller says
// `enabled={false}` (touch devices for pointer mode: there is no pointer).

export function DecodeText({
  text,
  mode,
  as: Tag = "span",
  chars = ".:",
  /** reveal: seconds for the whole line. pointer: max seconds per letter. */
  duration = 0.9,
  /** pointer mode: px radius around the pointer. */
  radius = 100,
  /** reveal mode: seconds to wait before starting. */
  delay = 0,
  enabled = true,
  className,
  style,
}: {
  text: string;
  mode: "reveal" | "pointer";
  as?: ElementType;
  chars?: string;
  duration?: number;
  radius?: number;
  delay?: number;
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    // Pointer mode waits for a mouse to come near before it loads GSAP:
    // on a page like the blog index that keeps the library off the wire
    // for everyone who never hovers the line, and for touch entirely.
    const armed =
      mode === "pointer"
        ? new Promise<void>((resolve) => {
            const near = (e: PointerEvent) => {
              if (e.pointerType === "touch") return;
              const r = root.getBoundingClientRect();
              if (
                e.clientX > r.left - radius &&
                e.clientX < r.right + radius &&
                e.clientY > r.top - radius &&
                e.clientY < r.bottom + radius
              ) {
                document.removeEventListener("pointermove", near);
                resolve();
              }
            };
            document.addEventListener("pointermove", near, { passive: true });
            cleanup = () => document.removeEventListener("pointermove", near);
          })
        : Promise.resolve();

    (async () => {
      await armed;
      if (cancelled) return;
      const [{ gsap }, { ScrambleTextPlugin }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrambleTextPlugin"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrambleTextPlugin);
      const visual = root.querySelector<HTMLElement>("[data-decode]");
      if (!visual) return;

      if (mode === "reveal") {
        const tween = gsap.fromTo(
          visual,
          { scrambleText: { text: "", chars } },
          {
            delay,
            duration,
            ease: "none",
            scrambleText: { text, chars, speed: 0.6, revealDelay: 0 },
          }
        );
        cleanup = () => {
          tween.kill();
          visual.textContent = text;
        };
        return;
      }

      // pointer: one span per character so each can scramble on its own.
      visual.textContent = "";
      const letters = Array.from(text).map((ch) => {
        const s = document.createElement("span");
        s.textContent = ch;
        s.dataset.ch = ch;
        s.style.display = "inline-block";
        // Keep spaces from collapsing inside inline-block spans.
        if (ch === " ") s.style.whiteSpace = "pre";
        visual.appendChild(s);
        return s;
      });
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        for (const el of letters) {
          if (el.dataset.ch === " ") continue;
          const r = el.getBoundingClientRect();
          const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          if (d < radius) {
            gsap.to(el, {
              overwrite: true,
              duration: duration * (1 - d / radius),
              ease: "none",
              scrambleText: { text: el.dataset.ch ?? "", chars, speed: 0.5 },
            });
          }
        }
      };
      root.addEventListener("pointermove", onMove);
      cleanup = () => {
        root.removeEventListener("pointermove", onMove);
        gsap.killTweensOf(letters);
        visual.textContent = text;
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [text, mode, chars, duration, radius, delay, enabled]);

  return (
    <Tag ref={rootRef} className={className} style={style}>
      {/* The sentence, for readers and crawlers: never touched. */}
      <span
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      <span data-decode aria-hidden="true">
        {text}
      </span>
    </Tag>
  );
}
