"use client";

import { useSyncExternalStore } from "react";
import styles from "../blog.module.css";
import {
  getReadingPosition,
  getServerReadingPosition,
  subscribeReadingPosition,
} from "./readingPosition";

// Appear only once the reader is genuinely into the article — about a
// viewport down, past the hero and byline. Earlier is just clutter.
const SHOW_AFTER_PX = 480;

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
  if (pos.y <= SHOW_AFTER_PX) return null;

  const pct = Math.round(pos.progress * 100);
  return (
    <button
      type="button"
      className={styles.backToTop}
      aria-label={`Back to top (${pct}% read)`}
      title="Back to top"
      onClick={() => {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
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
        {/* "To top" glyph: a pixel arrow hitting a ceiling bar. The bare
          * scrollbar triangle read as a button ornament; the bar is what
          * says "top". */}
        <path
          d="M3 3h10v2H3zM7 6h2v1H7zM6 7h4v1H6zM5 8h6v1H5zM7 9h2v4H7z"
          fill="#000"
        />
      </svg>
    </button>
  );
}
