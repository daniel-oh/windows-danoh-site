"use client";

// Next.js segment-level error boundary. Catches errors thrown while
// rendering anything under the root layout's children (i.e. any page
// route) and renders this in place of the crashed segment. For errors
// in the root layout itself, app/global-error.tsx takes over.
//
// Shares visual language with /error (the route) so a visitor sees
// the same retro-terminal fault screen whether they navigated there
// directly or landed here because a page threw.

import Link from "next/link";
import styles from "./error/error.module.css";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.root}>
      <div className={styles.scanlines} aria-hidden="true" />
      <main className={styles.terminal}>
        <div className={`${styles.line} ${styles.l1}`}>
          <span className={styles.prompt}>!</span>{" "}
          <span>fault detected</span>
        </div>
        <div className={`${styles.line} ${styles.l2}`}>
          <span className={styles.angle}>&gt;</span>{" "}
          <span>a page failed to render.</span>
        </div>
        <div className={`${styles.line} ${styles.l3}`}>
          <span className={styles.angle}>&gt;</span>{" "}
          <span>retry, or head back to safer ground.</span>
          <span className={styles.cursor} aria-hidden="true">
            _
          </span>
        </div>

        <div className={`${styles.actions} ${styles.l4}`}>
          <button onClick={() => reset()} className={styles.primary} type="button">
            [ Retry ]
          </button>
          <Link href="/" className={styles.secondary}>
            [ Return to desktop ]
          </Link>
        </div>

        {error.digest && (
          <p className={`${styles.signature} ${styles.l5}`}>
            ref // {error.digest}
          </p>
        )}
      </main>
    </div>
  );
}
