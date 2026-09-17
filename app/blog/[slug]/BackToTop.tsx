"use client";

import { useSyncExternalStore } from "react";
import styles from "../blog.module.css";
import {
  getReadingPosition,
  getServerReadingPosition,
  subscribeReadingPosition,
} from "./readingPosition";

/**
 * Back-to-top control: a beveled Win98 square button with a pixel
 * up-chevron, wrapped by a navy square trace that draws clockwise from
 * top-center as reading progress grows and completes at the end of the
 * page. The Win98 cousin of the circular ring on blog.cloudflare.com.
 */
export function BackToTop() {
  const pos = useSyncExternalStore(
    subscribeReadingPosition,
    getReadingPosition,
    getServerReadingPosition
  );
  // Appear only once the reader is genuinely into the article (the store
  // decides what "deep" means). Earlier is just clutter.
  if (!pos.deep) return null;

  const pct = Math.round(pos.progress * 100);
  return (
    <button
      type="button"
      className={styles.backToTop}
      // Static name. With the percentage in it, the label changed on every
      // 1% of scroll, which a screen reader re-announces on a focused
      // control. The status bar's Reading gauge already reports progress.
      aria-label="Back to top"
      title="Back to top"
      onClick={(e) => {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        // This button unmounts once the page is back at the top. For a
        // keyboard user that dropped focus onto <body>, so Tab restarted
        // from nowhere. Hand focus to the first stop on the page instead.
        // Mouse and touch users are left alone: focusing the skip link
        // would slide it into view for no reason.
        if (e.currentTarget.matches(":focus-visible")) {
          document
            .querySelector<HTMLAnchorElement>('a[href="#main"]')
            ?.focus({ preventScroll: true });
        }
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
    >
      {/* The trace sits OUTSIDE the button box (inset -3px) so the navy
        * line never fights the bevel pixels. Single path from top-center,
        * clockwise; pathLength normalizes it to 0-100 so the dashoffset
        * is just "percent left". */}
      <svg
        className={styles.backToTopTrace}
        viewBox="0 0 46 46"
        aria-hidden="true"
      >
        <path
          d="M23 1 H45 V45 H1 V1 H23"
          pathLength={100}
          fill="none"
          stroke="#000080"
          strokeWidth={2}
          strokeDasharray={100}
          strokeDashoffset={100 - pct}
          shapeRendering="crispEdges"
        />
      </svg>
      {/* Pixel up-chevron, drawn like the other 16x16 glyphs. */}
      <svg
        viewBox="0 0 16 16"
        width={16}
        height={16}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {/* One big pixel up-arrow, near full-glyph height: wide head,
          * thick shaft. Nothing to decode. */}
        <path
          d="M7 2h2v1H7zM6 3h4v1H6zM5 4h6v1H5zM4 5h8v1H4zM3 6h10v1H3zM6 7h4v7H6z"
          fill="#000"
        />
      </svg>
    </button>
  );
}
