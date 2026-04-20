"use client";

import Link from "next/link";
import styles from "./error.module.css";

// Route-level /error landing page (e.g. OAuth redirect target). This
// is NOT the Next.js error boundary — that's app/global-error.tsx.
// Keeping the same retro-terminal aesthetic as /logout so a visitor
// who hits either screen reads them as one coherent experience
// rather than two unrelated fallback UIs.
export default function ErrorPage({ reset }: { reset?: () => void }) {
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
          <span>an operation did not complete.</span>
        </div>
        <div className={`${styles.line} ${styles.l3}`}>
          <span className={styles.angle}>&gt;</span>{" "}
          <span>the site is fine. try again.</span>
          <span className={styles.cursor} aria-hidden="true">
            _
          </span>
        </div>

        <div className={`${styles.actions} ${styles.l4}`}>
          <button
            onClick={() => (reset ? reset() : location.reload())}
            className={styles.primary}
            type="button"
          >
            [ Retry ]
          </button>
          <Link href="/" className={styles.secondary}>
            [ Return to desktop ]
          </Link>
        </div>

        <p className={`${styles.signature} ${styles.l5}`}>
          danoh.com // status: recoverable
        </p>
      </main>
    </div>
  );
}
