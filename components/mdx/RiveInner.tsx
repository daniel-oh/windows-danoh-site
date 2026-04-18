"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRive } from "@rive-app/react-canvas";
import { RuntimeLoader } from "@rive-app/canvas";

// Self-host the Rive WASM binary to avoid pulling it from unpkg / jsdelivr
// at runtime. The binary ships as a static asset in /public. When the
// @rive-app/canvas package is upgraded, also re-copy rive.wasm +
// rive_fallback.wasm from node_modules into /public so the runtime and
// asset stay in lock-step (a version mismatch would crash WASM init).
if (typeof window !== "undefined") {
  RuntimeLoader.setWasmUrl("/rive.wasm");
}

export type RiveProps = {
  /** URL of the .riv asset, typically under /animations/. */
  src: string;
  /** Rendered canvas height. Width flexes with parent (maxWidth: 100%). */
  height?: number;
  /** Rendered canvas width. Defaults to 100%. */
  width?: number | string;
  /** Optional caption shown under the animation. */
  caption?: string;
  /** Describes the animation for screen readers + SEO. Required-ish. */
  alt?: string;
  /** Optional state-machine name to trigger (passed through to useRive). */
  stateMachines?: string | string[];
  /**
   * When true (default), one-shot animations are restarted on stop so
   * decorative embeds keep playing. Pass `loop={false}` for animations
   * that are meant to play once — confetti bursts, checkmarks, reveals
   * — so the author's intent is preserved.
   */
  loop?: boolean;
};

export function RiveInner({
  src,
  height = 300,
  width = "100%",
  caption,
  alt,
  stateMachines,
  loop = true,
}: RiveProps) {
  // Respect prefers-reduced-motion — skip autoplay if the visitor has
  // it set. Readers can still interact with the canvas if the Rive
  // file responds to state machines.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const { rive, RiveComponent } = useRive({
    src,
    autoplay: !reducedMotion,
    stateMachines,
  });

  // Loop animations that were authored as one-shot. State machines
  // usually loop natively, so this only matters for plain timeline
  // animations like the Rive Fire demo. When Rive fires its "stop"
  // event we replay immediately. Gated by reducedMotion so visitors
  // with that preference still only see one cycle (or zero, per the
  // autoplay:false above). Gated by the loop prop so embeds that
  // intentionally want one-shot semantics (confetti, checkmarks)
  // can opt out with `loop={false}`.
  useEffect(() => {
    if (!rive || reducedMotion || !loop) return;
    const restart = () => rive.play();
    rive.on("stop" as Parameters<typeof rive.on>[0], restart);
    return () => {
      rive.off("stop" as Parameters<typeof rive.off>[0], restart);
    };
  }, [rive, reducedMotion, loop]);

  const containerStyle: CSSProperties = {
    margin: "16px 0",
  };

  const canvasStyle: CSSProperties = {
    width,
    height,
    maxWidth: "100%",
    display: "block",
  };

  const ariaLabel =
    alt || caption || "Interactive animation embedded in this post.";

  return (
    <figure style={containerStyle}>
      <RiveComponent
        role="img"
        aria-label={ariaLabel}
        style={canvasStyle}
      />
      {caption && (
        <figcaption
          style={{
            fontSize: 12,
            color: "#555",
            textAlign: "center",
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
