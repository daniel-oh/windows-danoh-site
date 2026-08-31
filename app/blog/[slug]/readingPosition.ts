// Shared window-scroll position for the post page's two consumers: the
// status-bar Reading gauge and the back-to-top square trace. Same
// external-store idea as ../searchStatus.ts — two islands, no shared
// React parent, and Jotai isn't worth the bytes here. One passive
// listener total: attached with the first subscriber, detached with the
// last, so the pair of consumers never doubles the scroll work.

export type ReadingPosition = {
  /** window.scrollY in px. */
  y: number;
  /** 0..1, quantized to 1% — finer re-renders buy nothing visible. */
  progress: number;
};

const SERVER_SNAPSHOT: ReadingPosition = { y: 0, progress: 0 };

let position: ReadingPosition = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function onScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const raw = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  const progress = Math.round(raw * 100) / 100;
  if (progress === position.progress && window.scrollY === position.y) return;
  // New object per change: useSyncExternalStore compares by reference.
  position = { y: window.scrollY, progress };
  listeners.forEach((l) => l());
}

export function subscribeReadingPosition(cb: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }
  };
}

export function getReadingPosition(): ReadingPosition {
  return position;
}

export function getServerReadingPosition(): ReadingPosition {
  return SERVER_SNAPSHOT;
}
