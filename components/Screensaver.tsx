"use client";

import { useEffect, useRef, useState } from "react";

// Idle-triggered 3D Pipes screensaver. Desktop-pointer machines only
// (the "stepped away from the desk" concept doesn't exist on a phone,
// and the battery cost isn't worth it), never under reduced-motion.
// three.js and the pipes module load on the FIRST idle fire, not
// before — a visitor who never idles never downloads a byte of it.

// localStorage override ("danoh_saver_ms") exists for demos and
// tests — waiting out the real minute is nobody's idea of QA.
const IDLE_MS_DEFAULT = 60_000;
function idleMs(): number {
  try {
    const v = Number(localStorage.getItem("danoh_saver_ms"));
    return Number.isFinite(v) && v >= 1000 ? v : IDLE_MS_DEFAULT;
  } catch {
    return IDLE_MS_DEFAULT;
  }
}

export function Screensaver() {
  const [active, setActive] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const disposeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const eligible =
      window.matchMedia("(pointer: fine) and (min-width: 768px)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!eligible) return;

    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setActive(true), idleMs());
    };
    const activity = () => {
      // Dismissal of an active run is handled by the overlay's own
      // listeners; this only resets the countdown while it's off.
      arm();
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel"];
    events.forEach((e) =>
      window.addEventListener(e, activity, { passive: true })
    );
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, activity));
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let killed = false;

    void import("@/lib/screensaver/pipes").then(({ startPipes }) => {
      if (killed || !hostRef.current) return;
      disposeRef.current = startPipes(hostRef.current);
    });

    const dismiss = () => setActive(false);
    // A breath of delay so the same mouse twitch that has been idle
    // for a minute doesn't dismiss the saver the frame it appears.
    const t = setTimeout(() => {
      window.addEventListener("pointermove", dismiss, { passive: true });
      window.addEventListener("pointerdown", dismiss);
      window.addEventListener("keydown", dismiss);
      window.addEventListener("touchstart", dismiss, { passive: true });
    }, 700);

    return () => {
      killed = true;
      clearTimeout(t);
      window.removeEventListener("pointermove", dismiss);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("touchstart", dismiss);
      disposeRef.current?.();
      disposeRef.current = null;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={hostRef}
      role="presentation"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30000,
        background: "#000",
        cursor: "none",
      }}
    />
  );
}
