"use client";

import { useEffect, useState } from "react";
import styles from "../blog.module.css";
import { subscribeReadingPosition } from "./readingPosition";

type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
  num: string;
};

// Build "1.", "2.", "2.1" numbering like a Win98 help index. An h3
// arriving before any h2 promotes to a top-level entry rather than
// rendering an orphaned "0.1".
function numberItems(
  headings: { id: string; text: string; level: 2 | 3 }[],
): TocItem[] {
  let major = 0;
  let minor = 0;
  return headings.map((h) => {
    if (h.level === 2 || major === 0) {
      major += 1;
      minor = 0;
      return { ...h, level: h.level, num: `${major}.` };
    }
    minor += 1;
    return { ...h, num: `${major}.${minor}` };
  });
}

/**
 * Desktop-only Contents rail beside the post window, in the spirit of
 * blog.cloudflare.com's "On this page" — numbered like a Win98 help
 * index, current section shown as a sunken selected row, and a hover
 * that blurs every entry except the one under the pointer (CSS).
 *
 * Client island: it scans the server-rendered headings (ids come from
 * rehype-slug) after mount. Progressive enhancement — without JS the
 * rail simply doesn't exist, while #section links still work.
 */
export function TocRail() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    // Scans the headings and tracks the active one. Returns its cleanup.
    const start = (): (() => void) => {
      // Only MDX prose headings carry ids (rehype-slug runs on post
      // content alone; the JSX chrome's headings have none), so [id]
      // scoping is the whole filter. The prose wrapper's class is a
      // hashed CSS-module name, so it can't be used in a selector.
      const nodes = Array.from(
        document.querySelectorAll<HTMLHeadingElement>(
          "#main h2[id], #main h3[id]",
        ),
      );
      const scanned = nodes.map((n) => ({
        id: n.id,
        text: n.textContent ?? "",
        level: (n.tagName === "H2" ? 2 : 3) as 2 | 3,
      }));
      // The rail's items CAN only be known by reading the rendered DOM
      // (rehype-slug ids live in the server HTML, not in props), so this
      // is the sync-external-system-into-state case the rule can't tell
      // apart from a cascading-render bug. One setState, once, on mount.
      setItems(numberItems(scanned));
      if (nodes.length < 2) return () => {};

      // Active section = the last heading whose top sits above a line just
      // under the sticky title bar. Driven by the shared scroll store, NOT
      // an IntersectionObserver: an instant jump (anchor click, End key)
      // can move a heading across the viewport between observer samples
      // with no intersection change, so the observer never fires and the
      // highlight sticks. Offsets are cached and only re-measured when the
      // document height changes (images loading, viewport resize), so the
      // per-scroll work is a numeric compare, not a layout read.
      let offsets: { id: string; top: number }[] = [];
      let measuredHeight = 0;
      const measure = () => {
        measuredHeight = document.documentElement.scrollHeight;
        offsets = nodes.map((n) => ({
          id: n.id,
          top: n.getBoundingClientRect().top + window.scrollY,
        }));
      };
      const pick = () => {
        if (document.documentElement.scrollHeight !== measuredHeight) measure();
        const line = window.scrollY + 90; // sticky title bar + air
        let current = offsets[0]?.id ?? "";
        for (const o of offsets) {
          if (o.top <= line) current = o.id;
        }
        // A short final section can never scroll its heading up to the line:
        // the page runs out first. At the bottom, the last section is the
        // one being read.
        const doc = document.documentElement;
        if (window.scrollY + window.innerHeight >= doc.scrollHeight - 2) {
          current = offsets[offsets.length - 1]?.id ?? current;
        }
        setActive(current);
      };
      measure();
      pick();
      return subscribeReadingPosition(pick);
    };

    // The rail is display:none below 1280px (blog.module.css), so on
    // phones and laptops all of the above, the heading scan and a
    // per-scroll pick, was work for something nobody could see.
    const wide = window.matchMedia("(min-width: 1280px)");
    let stop: (() => void) | null = null;
    const sync = () => {
      if (wide.matches && !stop) stop = start();
      else if (!wide.matches && stop) {
        stop();
        stop = null;
      }
    };
    sync();
    wide.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      stop?.();
    };
  }, []);

  if (items.length < 2) return null;

  return (
    <nav className={styles.tocRail} aria-label="Contents">
      <div className={styles.tocTitle}>Contents</div>
      <ol className={styles.tocList}>
        {items.map((it) => (
          <li
            key={it.id}
            className={it.level === 3 ? styles.tocSub : undefined}
          >
            <a
              href={`#${it.id}`}
              className={active === it.id ? styles.tocActive : undefined}
              aria-current={active === it.id ? "location" : undefined}
            >
              <span className={styles.tocNum} aria-hidden="true">
                {it.num}
              </span>
              {it.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
