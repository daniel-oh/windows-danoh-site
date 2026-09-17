// Shared window-scroll position for the post page's two consumers: the
// status-bar Reading gauge and the back-to-top square trace. Same
// external-store idea as ../searchStatus.ts — two islands, no shared
// React parent, and Jotai isn't worth the bytes here. One passive
// listener total: attached with the first subscriber, detached with the
// last, so the pair of consumers never doubles the scroll work.

// About a viewport down: past the hero and byline. The only thing any
// React consumer needs from scrollY, so the raw pixel value stays out of
// the snapshot (see onScroll).
const DEEP_AFTER_PX = 480;

export type ReadingPosition = {
  /** True once the reader has scrolled past the hero. */
  deep: boolean;
  /** 0..1, quantized to 1% — finer re-renders buy nothing visible. */
  progress: number;
};

const SERVER_SNAPSHOT: ReadingPosition = { deep: false, progress: 0 };

let position: ReadingPosition = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function onScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  const raw = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  const progress = Math.round(raw * 100) / 100;
  const deep = window.scrollY > DEEP_AFTER_PX;
  // The snapshot only gets a new identity when something a consumer can
  // SHOW has changed. It used to carry raw scrollY, which changed on every
  // pixel and defeated the 1% quantization: useSyncExternalStore compares
  // by reference, so both islands re-rendered on every scroll event.
  if (progress !== position.progress || deep !== position.deep) {
    position = { deep, progress };
  }
  // Still notify on every scroll: TocRail reads scrollY itself to pick the
  // active heading and would lag by up to 1% of the page otherwise. For the
  // useSyncExternalStore consumers an unchanged snapshot is a no-op.
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
