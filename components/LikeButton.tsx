"use client";

import { useState } from "react";
import { useLike } from "@/lib/useLike";
import { Odometer } from "./Odometer";
import styles from "./LikeButton.module.css";

// The one reaction on a post: a like. A raised Win98 button holding an
// 11x11 pixel heart. Liking fills the heart, presses the button in, pops
// the heart with a little overshoot, throws eight pixel sparks and rolls
// the count up; unliking just deflates. The idea is React Bits'
// PulseHeart, redrawn for this desktop: square pixels instead of a pill,
// and a toggle that looks pressed because it is.
//
// Shared by the in-OS Blog program and the /blog/[slug] pages. `framed`
// adds the heading for hosts that don't provide their own.

// Filled heart; the outline is derived from it so the two always match.
const HEART = [
  "..##...##..",
  ".####.####.",
  "###########",
  "###########",
  "###########",
  ".#########.",
  "..#######..",
  "...#####...",
  "....###....",
  ".....#.....",
];
const filled = (x: number, y: number) => HEART[y]?.[x] === "#";
const EDGE = HEART.flatMap((row, y) =>
  Array.from(row).flatMap((c, x) =>
    c === "#" &&
    (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1))
      ? [[x, y]]
      : []
  )
);
const FILL = HEART.flatMap((row, y) =>
  Array.from(row).flatMap((c, x) => (c === "#" ? [[x, y]] : []))
);

function PixelHeart({ liked }: { liked: boolean }) {
  const px = liked ? FILL : EDGE;
  return (
    <svg
      viewBox="0 0 11 10"
      // 1:1 pixels: native size, crisp at any DPR, and about the height
      // of the label beside it, like a Win98 toolbar glyph.
      width="11"
      height="10"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={styles.heart}
    >
      {px.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
      ))}
      {/* A two-pixel glint, so the filled heart reads as lit. */}
      {liked && <rect x="2" y="2" width="2" height="1" className={styles.glint} />}
    </svg>
  );
}

export function LikeButton({ slug, framed = false }: { slug: string; framed?: boolean }) {
  const { count, liked, loaded, toggle } = useLike(slug);
  // Bumped on each like so the pop and the sparks replay from the start.
  const [pop, setPop] = useState(0);

  const onClick = () => {
    if (!liked) setPop((n) => n + 1);
    toggle();
  };

  const button = (
    <button
      type="button"
      className={styles.button}
      aria-pressed={liked}
      aria-label={`Like this post, ${count} ${count === 1 ? "like" : "likes"}`}
      data-liked={liked ? "" : undefined}
      onClick={onClick}
    >
      <span className={styles.icon} key={pop} data-pop={pop > 0 && liked ? "" : undefined}>
        <PixelHeart liked={liked} />
        {pop > 0 && liked && (
          <span className={styles.sparks} aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} style={{ "--a": `${i * 45}deg` } as React.CSSProperties} />
            ))}
          </span>
        )}
      </span>
      <span className={styles.label}>Like</span>
      {loaded && count > 0 && (
        <span className={styles.count}>
          <Odometer value={count} duration={350} stagger={60} />
        </span>
      )}
    </button>
  );

  if (!framed) return button;
  return (
    <div className={styles.frame}>
      <div className={styles.heading}>How did this land?</div>
      {button}
    </div>
  );
}
