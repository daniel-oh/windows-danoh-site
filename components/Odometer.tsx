"use client";

import { useEffect, useState } from "react";
import styles from "./Odometer.module.css";

// Digits that roll into place like a mechanical counter: each column is a
// strip of 0-9 that slides up to its digit, the columns staggered from
// the right. Eager on the desktop (the Welcome window shows it), so it
// is CSS transitions only and about a kilobyte. Under reduced motion the
// strips sit at their digit from the first paint.
//
// The idea is React Bits' Counter; that one needs framer-motion, this
// one does not.

export function Odometer({
  value,
  className,
  duration = 700,
  stagger = 90,
}: {
  value: number;
  className?: string;
  /** ms for one column to roll. */
  duration?: number;
  /** ms between columns, right to left. */
  stagger?: number;
}) {
  const text = value.toLocaleString();
  // First paint shows every digit at 0, then one frame later the real
  // digits, so the transition has somewhere to roll from.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const chars = Array.from(text);
  const digits = chars.filter((c) => /\d/.test(c)).length;
  let digitIndex = 0;

  return (
    <span className={[styles.odometer, className ?? ""].join(" ")} aria-hidden="true">
      {chars.map((c, i) => {
        if (!/\d/.test(c)) {
          return (
            <span key={i} className={styles.sep}>
              {c}
            </span>
          );
        }
        // Right-most digit rolls last, so the number seems to count up
        // into place rather than flip as one block.
        const fromRight = digits - 1 - digitIndex++;
        const d = settled ? Number(c) : 0;
        return (
          <span key={i} className={styles.column}>
            <span
              className={styles.strip}
              style={{
                transform: `translateY(${-d * 10}%)`,
                transitionDelay: `${fromRight * stagger}ms`,
                transitionDuration: `${duration}ms`,
              }}
            >
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n} className={styles.digit}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
