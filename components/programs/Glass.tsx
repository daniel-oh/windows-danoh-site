"use client";

import { useEffect, useState } from "react";
import { GlassPane } from "../fx/GlassPane";
import { useIsMobile } from "@/lib/useIsMobile";
import styles from "./Glass.module.css";

// A pane of glass with a title bar. It refracts whatever is under it and
// does nothing else; Window.tsx drops the grey behind this program so
// the desktop shows through. The hint is a Win98 tooltip that goes
// away on its own.

export function Glass() {
  const mobile = useIsMobile();
  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 4500);
    return () => clearTimeout(t);
  }, []);
  // The pane is absolutely positioned in a host, not an in-flow flex
  // child: Chromium at phone widths (no transform on a maximised window)
  // paints an in-flow backdrop-filter against nothing, and the glass
  // came out clear.
  return (
    <div className={styles.host}>
      <GlassPane className={styles.pane} refract={!mobile} frost={0.08} distortion={-140}>
        <p className={styles.hint} data-hidden={hint ? undefined : ""} aria-hidden={!hint}>
          A pane of glass. Drag it over things.
        </p>
      </GlassPane>
    </div>
  );
}
