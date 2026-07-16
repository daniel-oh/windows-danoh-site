"use client";

import { useEffect, useState } from "react";
import styles from "../blog.module.css";

// The reading-progress cell of the post status bar: "Reading: NN%"
// plus a segmented Win98 gauge. Client island because it needs the
// live scroll position; SSR renders the deterministic 0% state so
// hydration matches, then the mount-time measurement takes over.
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      // 1% granularity: a re-render per scroll frame buys nothing the
      // reader can see on a 220px track.
      setProgress((prev) => (Math.abs(p - prev) > 0.01 ? p : prev));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pct = Math.round(progress * 100);
  const label = pct >= 99 ? "Done · thanks for reading" : `Reading: ${pct}%`;

  return (
    <span
      className={`${styles.statusCell} ${styles.grow} ${styles.statusProgress}`}
    >
      <span>{label}</span>
      <span className={styles.progressTrack} aria-hidden="true">
        <span className={styles.progressFill} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
