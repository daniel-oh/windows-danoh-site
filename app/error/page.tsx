import Link from "next/link";
import type { Metadata } from "next";
import styles from "./error.module.css";

// Route-level /error landing page. Reached when a server action
// redirects here — most commonly OAuth failure (see lib/auth/actions.ts).
// This is NOT an error boundary; those live at app/error.tsx (segment)
// and app/global-error.tsx (root). Keeping the same retro-terminal
// look so a visitor who hits any of the three reads them as one
// coherent system.

export const metadata: Metadata = {
  title: "Error · Daniel Oh",
  description: "Something didn't complete. The site is fine.",
  robots: { index: false, follow: false },
};

export default function ErrorPage() {
  return (
    <div className={styles.root}>
      <div className={styles.scanlines} aria-hidden="true" />
      <main className={styles.terminal}>
        <h1 className={`${styles.line} ${styles.l1}`} style={{ font: "inherit", margin: 0 }}>
          <span className={styles.prompt}>!</span>{" "}
          <span>fault detected</span>
        </h1>
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
          <Link href="/" className={styles.primary}>
            [ Return to desktop ]
          </Link>
          <Link href="/blog" className={styles.secondary}>
            [ Read the blog ]
          </Link>
        </div>

        <p className={`${styles.signature} ${styles.l5}`}>
          danoh.com // status: recoverable
        </p>
      </main>
    </div>
  );
}
