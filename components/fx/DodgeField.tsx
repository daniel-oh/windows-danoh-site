"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMotionAllowed } from "@/lib/useMotionAllowed";
import { AT_REST, dodgeOffset, isAtRest, type Axis, type Offset, type Wall } from "@/lib/fx/dodge";
import styles from "./DodgeField.module.css";

// Something that does not want to be caught. Bring a cursor near it and it
// steps aside, springs back, and after a few goes it gives up and lets you
// have it.
//
// The rules it plays by, because a page is not a toy shop:
//   - Fine pointers only. There is no hovering on a phone, so on touch it
//     is ordinary content that never moves.
//   - Nothing under prefers-reduced-motion.
//   - Transform only, so it can never push the layout around, and clamped
//     to the viewport so it cannot hide off the edge of the screen.
//   - It always gives up (`patience`), because a control you cannot click
//     is a joke that stops being funny the first time you need it.

type RenderProps = { dodges: number; gave: boolean };

export function DodgeField({
  children,
  reach = 28,
  radius = 120,
  falloff = 2,
  fleeDuration = 130,
  returnDuration = 620,
  returnBounce = 0.1,
  axis = "both",
  wall = "clamp",
  patience = 4,
  fieldHeight,
  onCatch,
  className,
  runnerClassName,
}: {
  children: ReactNode | ((props: RenderProps) => ReactNode);
  /** Furthest it will move, in pixels. */
  reach?: number;
  /** How close the pointer gets before it reacts. */
  radius?: number;
  falloff?: number;
  /** Milliseconds to get out of the way, and to come back. */
  fleeDuration?: number;
  returnDuration?: number;
  /** 0 settles flat, higher overshoots on the way home. */
  returnBounce?: number;
  axis?: Axis;
  wall?: Wall;
  /** Dodges before it gives in. */
  patience?: number;
  /** Reserves height, for a field the runner roams inside. Text lines do
   * not need it: they move by transform and reserve nothing. */
  fieldHeight?: number;
  onCatch?: () => void;
  className?: string;
  runnerClassName?: string;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<HTMLDivElement>(null);
  const motion = useMotionAllowed();
  const [dodges, setDodges] = useState(0);
  const [gave, setGave] = useState(false);
  // Read by the pointer handler without re-subscribing it on every change.
  const live = useRef({ dodges, gave, reach, radius, falloff, axis, wall, patience });
  useEffect(() => {
    live.current = { dodges, gave, reach, radius, falloff, axis, wall, patience };
  }, [dodges, gave, reach, radius, falloff, axis, wall, patience]);

  const caught = useRef(false);
  const settle = useCallback(() => {
    caught.current = true;
    onCatch?.();
  }, [onCatch]);

  useEffect(() => {
    const runner = runnerRef.current;
    if (!runner || !motion) return;
    // A coarse pointer cannot hover, so there is nothing to dodge.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let offset: Offset = AT_REST;
    let resting = true;
    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const write = (next: Offset, fleeing: boolean) => {
      runner.style.transition = fleeing
        ? `transform ${fleeDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : `transform ${returnDuration}ms cubic-bezier(0.34, ${1 + returnBounce * 6}, 0.64, 1)`;
      runner.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      offset = next;
    };

    const measure = () => {
      frame = 0;
      const point = pending;
      pending = null;
      if (!point) return;
      const { dodges: count, gave: gaveUp, patience: limit, ...tuning } = live.current;
      if (gaveUp) return;

      // Measure where it would sit at rest, not where it currently is:
      // otherwise each dodge measures from the last one and it walks away.
      const rect = runner.getBoundingClientRect();
      const atRest = {
        left: rect.left - offset.x,
        top: rect.top - offset.y,
        width: rect.width,
        height: rect.height,
      };
      const next = dodgeOffset({
        pointer: point,
        rect: atRest,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        ...tuning,
      });

      if (isAtRest(next)) {
        if (!resting) {
          resting = true;
          write(AT_REST, false);
        }
        return;
      }

      if (resting) {
        resting = false;
        const total = count + 1;
        setDodges(total);
        if (total >= limit) {
          // Out of patience: stop, come back, and stay caught.
          setGave(true);
          write(AT_REST, false);
          settle();
          return;
        }
      }
      write(next, true);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pending = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(measure);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
      runner.style.transition = "";
      runner.style.transform = "";
    };
  }, [motion, fleeDuration, returnDuration, returnBounce, settle]);

  const content = typeof children === "function" ? children({ dodges, gave }) : children;

  return (
    <div
      ref={fieldRef}
      className={[styles.field, className ?? ""].join(" ")}
      style={fieldHeight ? { minHeight: fieldHeight } : undefined}
      data-gave={gave ? "" : undefined}
    >
      <div ref={runnerRef} className={[styles.runner, runnerClassName ?? ""].join(" ")}>
        {content}
      </div>
    </div>
  );
}
