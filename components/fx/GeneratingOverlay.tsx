"use client";

import { useMotionAllowed } from "@/lib/useMotionAllowed";
import { useIsMobile } from "@/lib/useIsMobile";
import { GlassPane } from "./GlassPane";
import { LatticeLoader } from "./LatticeLoader";
import styles from "./GeneratingOverlay.module.css";

// What a window looks like before the AI has filled it in: a pane of glass
// over the desktop with a small Win98 status panel in the middle. The
// label reads "Thinking" until the first byte of the program arrives, then
// "Streaming" as the glass dissolves and the app draws itself behind it.
//
// Loaded on demand from Window.tsx, so the desktop bundle never carries
// it. The panel is opaque grey by design: text on a refracted wallpaper
// can land on anything, and the timer has to stay readable on all of them.

export function GeneratingOverlay({
  streaming,
  onStop,
}: {
  streaming: boolean;
  onStop: () => void;
}) {
  const motion = useMotionAllowed();
  // Phones get the frosted blur: it runs on the GPU, where the SVG
  // displacement filter is rasterised on the CPU and a maximised window
  // at 3x is most of the screen.
  const mobile = useIsMobile();
  return (
    <GlassPane
      className={styles.pane}
      refract={motion && !mobile}
      frost={0.14}
      distortion={-160}
      style={{
        opacity: streaming ? 0 : 1,
        transition: motion ? "opacity 400ms ease" : "none",
        pointerEvents: streaming ? "none" : "auto",
      }}
    >
      <div className={styles.panel}>
        <LatticeLoader
          label={streaming ? "Streaming" : "Thinking"}
          className={styles.loader}
        />
        <button type="button" className={styles.stop} onClick={onStop}>
          Stop
        </button>
      </div>
    </GlassPane>
  );
}
