"use client";

import cx from "classnames";
import {
  atom,
  getDefaultStore,
  useAtom,
  useAtomValue,
  useSetAtom,
} from "jotai";
import { focusedWindowAtom, zOrderAtom } from "@/state/focusedWindow";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { windowsListAtom } from "@/state/windowsList";
import { MIN_WINDOW_SIZE, windowAtomFamily } from "@/state/window";
import { WindowBody } from "./WindowBody";
import styles from "./Window.module.css";
import React, { memo, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/lib/useIsMobile";
import Image from "next/image";
import { createWindow } from "@/lib/createWindow";
import { isCoarsePointer } from "@/lib/isCoarsePointer";
import { WindowMenuBar } from "./WindowMenuBar";

const isResizingAtom = atom(false);

export const Window = memo(WindowInner);

function WindowInner({ id }: { id: string }) {
  const [state, dispatch] = useAtom(windowAtomFamily(id));
  const windowsDispatch = useSetAtom(windowsListAtom);
  const [focusedWindow, setFocusedWindow] = useAtom(focusedWindowAtom);
  const zOrder = useAtomValue(zOrderAtom);
  const isResizing = useAtomValue(isResizingAtom);
  const mobile = useIsMobile();
  const [isMinimizing, setIsMinimizing] = useState(false);
  const prevStatusRef = useRef(state.status);

  useEffect(() => {
    if (prevStatusRef.current !== "minimized" && state.status === "minimized") {
      setIsMinimizing(true);
      const timer = setTimeout(() => setIsMinimizing(false), 100);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = state.status;
  }, [state.status]);

  const isHidden = state.status === "minimized" && !isMinimizing;
  const windowRef = useRef<HTMLDivElement>(null);

  // Focus trap: when this window is the focused one, Tab cycles
  // through its controls rather than escaping into another window
  // or the desktop. Inactive (background) windows don't install the
  // trap, so click-or-focus on a different window releases it
  // naturally. Matches the native OS metaphor — Tab moves within
  // the window; window-switching is a separate gesture.
  useFocusTrap(windowRef, focusedWindow === id && !isHidden);

  // Move focus into newly opened windows so keyboard users can immediately
  // act on them (Tab into controls, Esc to close). Scoped to the window
  // BODY: searching the whole window made the title-bar Help button the
  // first match for iframe programs, so pressing Space right after
  // opening a game launched Fix & Iterate instead of playing. For
  // iframe programs the iframe itself takes focus — keys reach the app
  // immediately.
  useEffect(() => {
    if (isHidden) return;
    const el = windowRef.current;
    if (!el) return;
    const body = el.querySelector<HTMLElement>(".window-body") ?? el;
    // The iframe outranks everything: program windows also contain the
    // File menu button, and "first button wins" would aim Space/Enter
    // at the menu instead of the app. Focusing the iframe is invisible
    // (no ring) and routes keys to the app, so it's fine on any device.
    const iframe = body.querySelector<HTMLElement>("iframe");
    if (iframe) {
      iframe.focus({ preventScroll: true });
      return;
    }
    // On touch devices there's no keyboard to serve, and moving focus on
    // open just paints a stray focus ring on whatever control is first
    // (e.g. the Welcome window's GitHub button) — a sloppy first
    // impression, and the ring even clips against the body's left edge.
    // Leave focus alone; taps reach controls directly. Keyboard/mouse
    // users still get focus moved in so Tab/Esc work immediately.
    if (isCoarsePointer()) return;
    const focusTarget =
      body.querySelector<HTMLElement>(
        "input, textarea, [autofocus], button:not([aria-label='Close'])"
      ) ?? el;
    focusTarget.focus({ preventScroll: true });
    // Run only once on mount (and when restoring from minimized).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect when an iframe inside this window gets focus (click into iframe)
  useEffect(() => {
    if (state.program.type !== "iframe") return;

    const onBlur = () => {
      // When the main window loses focus, check if it went to our iframe
      setTimeout(() => {
        const active = document.activeElement;
        if (active?.tagName === "IFRAME" && windowRef.current?.contains(active)) {
          setFocusedWindow(id);
        }
      }, 0);
    };

    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [id, setFocusedWindow, state.program.type]);

  // Pin the window's live rendered height before a resize begins. Auto-
  // height windows (Welcome, Mail, alerts, ...) have no numeric height in
  // state; without this the first resize frame would grow from zero and
  // clamp to the minimum, snapping the window shut before it grows.
  const measureBeforeResize = () => {
    const el = windowRef.current;
    if (el) {
      dispatch({ type: "MATERIALIZE_HEIGHT", payload: el.offsetHeight });
    }
  };

  return (
    <div
      className={cx("window", {
        [styles.windowOpen]: state.status !== "minimized" && !isMinimizing,
        [styles.windowMinimize]: isMinimizing,
      })}
      role={state.program.type === "alert" ? "alertdialog" : "dialog"}
      aria-label={state.title}
      aria-describedby={
        state.program.type === "alert" ? `alert-message-${id}` : undefined
      }
      ref={windowRef}
      id={id}
      tabIndex={-1}
      onMouseDown={() => setFocusedWindow(id)}
      onTouchStart={() => setFocusedWindow(id)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: state.status === "maximized" ? "100%" : state.size.width,
        height:
          state.status === "maximized"
            ? "calc(100% - var(--taskbar-height))"
            : state.size.height,
        maxHeight:
          state.size.height === "auto" && state.status !== "maximized"
            ? "700px"
            : undefined,
        transform:
          state.status === "maximized"
            ? "none"
            : `translate(${state.pos.x}px, ${state.pos.y}px)`,
        display: isHidden ? "none" : "flex",
        flexDirection: "column",
        overflow: "hidden",
        opacity: isResizing && focusedWindow === id ? 0.85 : 1,
        zIndex: zOrder[id] ?? 0,
        isolation: "isolate",
        minWidth: MIN_WINDOW_SIZE.width,
        minHeight: MIN_WINDOW_SIZE.height,
      }}
    >
      <div
        className={cx("title-bar", {
          inactive: focusedWindow !== id,
        })}
        {...createResizeEvent((e, delta) => {
          // Read status from the store, not the render closure: the drag
          // listeners installed at mousedown outlive this render, so the
          // captured `state` goes stale after the first TOGGLE_MAXIMIZE
          // and the window would strobe maximize/restore on every frame.
          const live = getDefaultStore().get(windowAtomFamily(id));
          if (live.status === "maximized") {
            // Auto-restore when an intentional drag starts. Threshold is
            // finger-jitter-sized so a touch tap on the title bar doesn't
            // accidentally un-maximize.
            if (Math.abs(delta.x) <= 8 && Math.abs(delta.y) <= 8) {
              return;
            }
            dispatch({ type: "TOGGLE_MAXIMIZE" });
            // Restoring snaps back to the stored pre-maximize pos, which
            // teleports the window out from under the pointer. Re-place
            // it so the cursor keeps the same proportional spot along
            // the title bar and the drag continues seamlessly.
            const point = "touches" in e ? e.touches[0] : e;
            if (point) {
              const targetX =
                point.clientX -
                (point.clientX / window.innerWidth) * live.size.width;
              const targetY = point.clientY - 10;
              dispatch({
                type: "MOVE",
                payload: {
                  dx: targetX - live.pos.x,
                  dy: targetY - live.pos.y,
                },
              });
              return;
            }
          }
          dispatch({
            type: "MOVE",
            payload: { dx: delta.x, dy: delta.y },
          });
        })}
      >
        <div
          className={styles.title}
          style={{
            overflow: "hidden",
          }}
        >
          {state.icon && (
            <Image
              unoptimized
              src={state.icon}
              alt={state.title}
              width={16}
              height={16}
            />
          )}
          <div
            className="title-bar-text"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {state.title}
          </div>
        </div>
        <div
          className="title-bar-controls"
          // Keep control taps from bubbling into the title-bar drag
          // handler — on touch, a tiny wobble during a tap on Close/
          // Minimize would otherwise start a window drag (or un-maximize)
          // before the click lands. Focus explicitly since we cut off
          // the window's own focus-on-mousedown.
          onMouseDown={(e) => {
            e.stopPropagation();
            setFocusedWindow(id);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            setFocusedWindow(id);
          }}
        >
          {state.program.type !== "iframe" ? null : (
            <button
              aria-label="Help"
              title="Fix & Iterate"
              style={{
                marginRight: 2,
              }}
              onClick={() =>
                createWindow({
                  title: "Fix & Iterate",
                  program: { type: "help", targetWindowID: id },
                  size: {
                    width: 340,
                    height: 400,
                  },
                })
              }
            ></button>
          )}
          <button
            aria-label="Minimize"
            onClick={() => {
              const finish = () => {
                dispatch({ type: "TOGGLE_MINIMIZE" });
                if (focusedWindow !== id) return;
                // Mirror the close path (state/windowsList.tsx): hand focus
                // to the top remaining non-minimized window instead of
                // stranding keyboard/screen-reader users on <body>.
                const store = getDefaultStore();
                const remaining = store
                  .get(windowsListAtom)
                  .filter(
                    (w) => store.get(windowAtomFamily(w)).status !== "minimized"
                  );
                if (!remaining.length) {
                  setFocusedWindow(null);
                  return;
                }
                const z = store.get(zOrderAtom);
                const top = remaining.reduce((a, b) =>
                  (z[a] ?? 0) >= (z[b] ?? 0) ? a : b
                );
                setFocusedWindow(top);
                setTimeout(
                  () =>
                    document.getElementById(top)?.focus({ preventScroll: true }),
                  0
                );
              };
              const el = windowRef.current;
              const btn = document.querySelector(
                `[data-taskbar-for="${id}"]`
              );
              if (
                !el ||
                !btn ||
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ) {
                finish();
                return;
              }
              // Genie effect: shrink toward this window's taskbar
              // button. We tween a plain object and write the NATIVE
              // standalone `translate`/`scale` CSS properties by hand —
              // they compose with the React-managed `transform`, and
              // GSAP's own transform pipeline (which would clobber it)
              // never gets involved.
              void import("gsap").then(({ gsap }) => {
                const er = el.getBoundingClientRect();
                const br = btn.getBoundingClientRect();
                const v = { x: 0, y: 0, s: 1, o: 1 };
                const dx = br.left + br.width / 2 - (er.left + er.width / 2);
                const dy = br.top + br.height / 2 - (er.top + er.height / 2);
                gsap.to(v, {
                  x: dx,
                  y: dy,
                  s: 0.04,
                  o: 0.4,
                  duration: 0.26,
                  ease: "power3.in",
                  onUpdate: () => {
                    el.style.translate = `${v.x}px ${v.y}px`;
                    el.style.scale = String(v.s);
                    el.style.opacity = String(v.o);
                  },
                  onComplete: () => {
                    finish();
                    // Clear after the minimize-fade window has passed
                    // so the full-size frame never flashes.
                    setTimeout(() => {
                      el.style.translate = "";
                      el.style.scale = "";
                      el.style.opacity = "";
                    }, 150);
                  },
                });
              });
            }}
          ></button>
          <button
            aria-label={state.status === "maximized" ? "Restore" : "Maximize"}
            onClick={() => dispatch({ type: "TOGGLE_MAXIMIZE" })}
          ></button>
          <button
            aria-label="Close"
            style={{
              marginLeft: 0,
            }}
            onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
          ></button>
        </div>
      </div>

      <div
        className="window-body"
        style={{
          flex: 1,
          pointerEvents: isResizing ? "none" : "auto",
          marginTop: state.program.type === "iframe" ? 0 : undefined,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <WindowMenuBar id={id} />
        {state.loading && (
          <div className={styles.loadingOverlay} role="status">
            <progress />
            <div className={styles.loadingText}>Generating program...</div>
            <div className={styles.loadingActions}>
              <button onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}>
                Stop
              </button>
            </div>
          </div>
        )}
        <div style={{ flex: 1, display: state.loading ? "none" : "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          <WindowBody id={id} program={state.program} error={state.error} />
        </div>
      </div>
      {!mobile && (
        <>
          {/* right side */}
          <div
            style={{
              top: 0,
              right: -4,
              bottom: 0,
              position: "absolute",
              width: 7,
              cursor: "ew-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: { side: "right", dx: delta.x, dy: delta.y },
              });
            }, measureBeforeResize)}
          ></div>
          {/* left side */}
          <div
            style={{
              top: 0,
              left: -4,
              bottom: 0,
              position: "absolute",
              width: 7,
              cursor: "ew-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: { side: "left", dx: delta.x, dy: delta.y },
              });
            }, measureBeforeResize)}
          ></div>
          {/* bottom side */}
          <div
            style={{
              left: 0,
              right: 0,
              bottom: -4,
              position: "absolute",
              height: 7,
              cursor: "ns-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: { side: "bottom", dx: delta.x, dy: delta.y },
              });
            }, measureBeforeResize)}
          ></div>
          {/* top side */}
          <div
            style={{
              top: -4,
              left: 0,
              right: 0,
              position: "absolute",
              height: 7,
              cursor: "ns-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: { side: "top", dx: delta.x, dy: delta.y },
              });
            }, measureBeforeResize)}
          ></div>
          {/* top left */}
          <div
            style={{
              top: -4,
              left: -4,
              position: "absolute",
              width: 7,
              height: 7,
              cursor: "nwse-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: { side: "top-left", dx: delta.x, dy: delta.y },
              });
            }, measureBeforeResize)}
          ></div>
          {/* top right */}
          <div
            style={{
              top: -4,
              right: -4,
              position: "absolute",
              width: 7,
              height: 7,
              cursor: "nesw-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: { side: "top-right", dx: delta.x, dy: delta.y },
              });
            }, measureBeforeResize)}
          ></div>
          {/* bottom left */}
          <div
            style={{
              bottom: -4,
              left: -4,
              position: "absolute",
              width: 7,
              height: 7,
              cursor: "nesw-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: { side: "bottom-left", dx: delta.x, dy: delta.y },
              });
            }, measureBeforeResize)}
          ></div>
          {/* bottom right */}
          <div
            style={{
              bottom: -4,
              right: -4,
              position: "absolute",
              width: 7,
              height: 7,
              cursor: "nwse-resize",
            }}
            {...createResizeEvent((_e, delta) => {
              dispatch({
                type: "RESIZE",
                payload: {
                  side: "bottom-right",
                  dx: delta.x,
                  dy: delta.y,
                },
              });
            }, measureBeforeResize)}
          ></div>
        </>
      )}
      {mobile && state.status !== "maximized" && (
        <div
          style={{
            bottom: 0,
            right: 0,
            position: "absolute",
            width: 24,
            height: 24,
            cursor: "nwse-resize",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            color: "#808080",
            userSelect: "none",
          }}
          {...createResizeEvent((_e, delta) => {
            dispatch({
              type: "RESIZE",
              payload: { side: "bottom-right", dx: delta.x, dy: delta.y },
            });
          }, measureBeforeResize)}
        >
          ⟋
        </div>
      )}
    </div>
  );
}

function createResizeEvent<T>(
  cb: (e: MouseEvent | TouchEvent, delta: { x: number; y: number }) => void,
  onStart?: () => void
): { onMouseDown: React.MouseEventHandler<T>; onTouchStart: React.TouchEventHandler<T> } {
  const handleStart = (e: MouseEvent | TouchEvent) => {
    onStart?.();
    let last = { x: 0, y: 0 };
    if ("clientX" in e) {
      last = { x: e.clientX, y: e.clientY };
    } else if ("touches" in e) {
      const touch = e.touches[0];
      last = { x: touch.clientX, y: touch.clientY };
    }

    // rAF-coalesce move events so we dispatch at most once per frame
    let rafId: number | null = null;
    let pending: MouseEvent | TouchEvent | null = null;
    const flush = () => {
      rafId = null;
      const ev = pending;
      if (!ev) return;
      pending = null;
      let delta = { x: 0, y: 0 };
      if ("clientX" in ev) {
        delta = { x: ev.clientX - last.x, y: ev.clientY - last.y };
        last = { x: ev.clientX, y: ev.clientY };
      } else if ("touches" in ev) {
        const touch = ev.touches[0];
        delta = { x: touch.clientX - last.x, y: touch.clientY - last.y };
        last = { x: touch.clientX, y: touch.clientY };
      }
      cb(ev, delta);
    };
    const handleMove = (ev: MouseEvent | TouchEvent) => {
      pending = ev;
      if (rafId == null) rafId = requestAnimationFrame(flush);
    };

    getDefaultStore().set(isResizingAtom, true);

    const handleEnd = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("blur", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      getDefaultStore().set(isResizingAtom, false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("blur", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleEnd);
  };

  return {
    onMouseDown: (e: React.MouseEvent<T>) => handleStart(e.nativeEvent),
    onTouchStart: (e: React.TouchEvent<T>) => handleStart(e.nativeEvent),
  };
}
