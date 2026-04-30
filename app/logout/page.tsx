import Link from "next/link";
import type { Metadata } from "next";
import styles from "./logout.module.css";

// noindex/nofollow because the page is transient — but if the URL
// gets shared anyway, the OG override keeps the social card from
// showing the homepage title and URL by mistake.
const TITLE = "Logged off · Daniel Oh";
const DESCRIPTION = "Session terminated. You are signed out of danoh.com.";
const URL = "https://danoh.com/logout";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Matrix-style terminal farewell. Phosphor green on black, staggered
// line reveals, a blinking cursor on the final line, and a subtle
// scanline overlay for CRT flavor. Full accessible fallback: the
// prefers-reduced-motion path paints every line instantly at the
// start, so screen-reader and motion-sensitive visitors get the
// whole message without any animation timing.
export default function LoggedOff() {
  return (
    <div className={styles.root}>
      <div className={styles.scanlines} aria-hidden="true" />
      <main className={styles.terminal} aria-live="polite">
        <div className={`${styles.line} ${styles.l1}`}>
          <span className={styles.prompt}>$</span>{" "}
          <span>logout</span>
        </div>
        <div className={`${styles.line} ${styles.l2}`}>
          <span className={styles.angle}>&gt;</span>{" "}
          <span>disconnecting from danoh.com...</span>
        </div>
        <div className={`${styles.line} ${styles.l3}`}>
          <span className={styles.angle}>&gt;</span>{" "}
          <span>session terminated.</span>
        </div>
        <div className={`${styles.line} ${styles.l4}`}>
          <span className={styles.angle}>&gt;</span>{" "}
          <span>ready for next login</span>
          <span className={styles.cursor} aria-hidden="true">
            _
          </span>
        </div>

        <div className={`${styles.actions} ${styles.l5}`}>
          <Link href="/" className={styles.primary}>
            [ Restart ]
          </Link>
          <Link href="/blog" className={styles.secondary}>
            [ Browse Archive ]
          </Link>
        </div>

        <p className={`${styles.signature} ${styles.l6}`}>
          danoh.com // daniel oh
        </p>
      </main>
    </div>
  );
}
