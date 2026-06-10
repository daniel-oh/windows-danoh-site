"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { useRive } from "@rive-app/react-canvas";
import { EventType, RuntimeLoader } from "@rive-app/canvas";

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
   * When true, one-shot animations are restarted on stop so decorative
   * embeds keep playing. Default is false — the .riv file's authored
   * Loop / One-shot flag is respected (matching how <video>, <audio>,
   * and CSS animations all default to the asset's own playback mode).
   * Pass `loop` on ambient decorative embeds where one-shot would read
   * as "broken".
   */
  loop?: boolean;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function RiveInner({
  src,
  height = 300,
  width = "100%",
  caption,
  alt,
  stateMachines,
  loop = false,
}: RiveProps) {
  // Respect prefers-reduced-motion — skip autoplay if the visitor has
  // it set. Readers can still interact with the canvas if the Rive
  // file responds to state machines. useSyncExternalStore because the
  // media query IS an external store; the server snapshot is false.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );

  const { rive, RiveComponent } = useRive({
    src,
    autoplay: !reducedMotion,
    stateMachines,
  });

  // Loop animations that were authored as one-shot. When a one-shot
  // finishes, the playhead sits at the end — calling play() alone
  // doesn't rewind, so we use reset({autoplay: true}) which rewinds
  // AND plays in one call.
  //
  // Reset internally calls stop() which synchronously fires the Stop
  // event. If we're still subscribed when that happens, our listener
  // re-enters reset → stack overflow. Same hazard fires on unmount:
  // Rive's cleanupInstances calls stop(), fires Stop, and if we're
  // still subscribed we'd try to reset a torn-down instance.
  //
  // Mitigation: unsubscribe before reset, re-subscribe on the next
  // microtask, and hard-gate on a `mounted` flag so the cleanup path
  // can't trip the listener.
  useEffect(() => {
    if (!rive || reducedMotion || !loop) return;
    let mounted = true;
    const restart = () => {
      if (!mounted) return;
      rive.off(EventType.Stop, restart);
      rive.reset({ autoplay: true });
      queueMicrotask(() => {
        if (!mounted) return;
        rive.on(EventType.Stop, restart);
      });
    };
    rive.on(EventType.Stop, restart);
    return () => {
      mounted = false;
      rive.off(EventType.Stop, restart);
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
