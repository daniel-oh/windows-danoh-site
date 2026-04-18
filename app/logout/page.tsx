import Link from "next/link";
import type { Metadata } from "next";
import styles from "./logout.module.css";

export const metadata: Metadata = {
  title: "Logged off · Daniel Oh",
  description: "You are safely logged off from danoh.com.",
  robots: { index: false, follow: false },
};

// Classic Win95 "It is now safe to turn off your computer" screen,
// re-dressed for danoh.com. Amber-on-black is the part that reads as
// nostalgia at a glance; the CTA below keeps it functional for
// visitors who actually want to do something next.
export default function LoggedOff() {
  return (
    <div className={styles.root}>
      <div className={styles.screen}>
        <h1 className={styles.headline}>
          It&apos;s now safe to turn off your computer.
        </h1>
        <p className={styles.sub}>
          You&apos;ve been signed out of danoh.com.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>
            Restart
          </Link>
          <Link href="/blog" className={styles.secondary}>
            Read the blog
          </Link>
        </div>
        <p className={styles.signature}>danoh.com</p>
      </div>
    </div>
  );
}
