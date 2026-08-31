"use client";

import { useSyncExternalStore } from "react";
import styles from "../blog.module.css";
import {
  getReadingPosition,
  getServerReadingPosition,
  subscribeReadingPosition,
} from "./readingPosition";

// The reading-progress cell of the post status bar: "Reading: NN%"
// plus a segmented Win98 gauge. Scroll measurement lives in the shared
// readingPosition store (the BackToTop trace reads the same numbers, so
// only one listener exists); SSR renders the deterministic 0% state so
// hydration matches.
export function ReadingProgress() {
  const { progress } = useSyncExternalStore(
    subscribeReadingPosition,
    getReadingPosition,
    getServerReadingPosition
  );

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
