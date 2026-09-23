"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMotionAllowed } from "@/lib/useMotionAllowed";
import {
  AT_REST,
  dodgeOffset,
  isAtRest,
  pointerDistance,
  type Axis,
  type Measure,
  type Offset,
  type Wall,
} from "@/lib/fx/dodge";
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
//     is a joke that stops being funny the first time you need it, and it
//     is ready to play again once the pointer has been away a while
//     (`rearmAfter`), so the joke is not spent for the rest of the visit.

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
  rearmAfter = 2000,
  measure = "center",
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
  /** Milliseconds the pointer must stay away before it will dodge again. */
  rearmAfter?: number;
  /** Distance from the centre, or from the nearest edge (long text). */
  measure?: Measure;
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
  const live = useRef({ reach, radius, falloff, axis, wall, patience, rearmAfter, measure });
  useEffect(() => {
    live.current = { reach, radius, falloff, axis, wall, patience, rearmAfter, measure };
  }, [reach, radius, falloff, axis, wall, patience, rearmAfter, measure]);

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
    let frame = 0;
    let pending: { x: number; y: number } | null = null;
    // Tracked here, not in React state: state lags a render behind the
    // pointer, so a quick pass could be counted twice.
    let count = 0;
    let gaveUp = false;
    let near = false;
    let awaySince = 0;

    const write = (next: Offset, fleeing: boolean) => {
      runner.style.transition = fleeing
        ? `transform ${fleeDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`
        : `transform ${returnDuration}ms cubic-bezier(0.34, ${1 + returnBounce * 6}, 0.64, 1)`;
      runner.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      offset = next;
    };

    const measureNow = () => {
      frame = 0;
      const point = pending;
      pending = null;
      if (!point) return;
      const { patience: limit, rearmAfter: rearm, measure: from, ...tuning } = live.current;

      // Where it would sit at rest, not where it is: measured from its own
      // last dodge, it would walk away across the page.
      const rect = runner.getBoundingClientRect();
      const atRest = {
        left: rect.left - offset.x,
        top: rect.top - offset.y,
        width: rect.width,
        height: rect.height,
      };
      const distance = pointerDistance(point, atRest, from);
      // Two radii, so a pointer resting on the boundary does not flicker it
      // in and out, and each flicker no longer counts as a dodge (which
      // used up its patience in a second and left it still).
      const now = performance.now();
      if (gaveUp && !near && awaySince && now - awaySince > rearm) {
        // Away long enough: ready to play again. Checked first, so a
        // pointer that comes straight back into range still gets a dodge.
        gaveUp = false;
        count = 0;
        setDodges(0);
        setGave(false);
      }
      if (!near && distance < tuning.radius) {
        near = true;
        awaySince = 0;
        if (!gaveUp) {
          count += 1;
          setDodges(count);
          if (count >= limit) {
            gaveUp = true;
            setGave(true);
            write(AT_REST, false);
            settle();
          }
        }
      } else if (near && distance > tuning.radius * 1.25) {
        near = false;
        awaySince = now;
      }

      if (gaveUp || !near) {
        if (!isAtRest(offset)) write(AT_REST, false);
        return;
      }
      const next = dodgeOffset({
        pointer: point,
        rect: atRest,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        measure: from,
        ...tuning,
      });
      write(next, true);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pending = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(measureNow);
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
