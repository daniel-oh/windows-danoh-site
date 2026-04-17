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
import { windowsListAtom } from "@/state/windowsList";
import { MIN_WINDOW_SIZE, windowAtomFamily } from "@/state/window";
import { WindowBody } from "./WindowBody";
import styles from "./Window.module.css";
import React, { memo, useEffect, useRef, useState } from "react";
import { isMobile } from "@/lib/isMobile";
import Image from "next/image";
import { createWindow } from "@/lib/createWindow";
import { WindowMenuBar } from "./WindowMenuBar";

const isResizingAtom = atom(false);

export const Window = memo(WindowInner);

function WindowInner({ id }: { id: string }) {
  const [state, dispatch] = useAtom(windowAtomFamily(id));
  const windowsDispatch = useSetAtom(windowsListAtom);
  const [focusedWindow, setFocusedWindow] = useAtom(focusedWindowAtom);
  const zOrder = useAtomValue(zOrderAtom);
  const isResizing = useAtomValue(isResizingAtom);
  const [mobile, setMobileState] = useState(false);
  const [isMinimizing, setIsMinimizing] = useState(false);

  useEffect(() => {
    setMobileState(isMobile());
  }, []);
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

  // Move focus into newly opened windows so keyboard users can immediately
  // act on them (Tab into controls, Esc to close).
  useEffect(() => {
    if (isHidden) return;
    const el = windowRef.current;
    if (!el) return;
    const focusTarget =
      el.querySelector<HTMLElement>(
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

  return (
    <div
      className={cx("window", {
        [styles.windowOpen]: state.status !== "minimized" && !isMinimizing,
        [styles.windowMinimize]: isMinimizing,
      })}
      role="dialog"
      aria-label={state.title}
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
        {...createResizeEvent((_e, delta) => {
          // Auto-restore maximized windows when dragging starts
          if (state.status === "maximized" && (Math.abs(delta.x) > 2 || Math.abs(delta.y) > 2)) {
            dispatch({ type: "TOGGLE_MAXIMIZE" });
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
        <div className="title-bar-controls">
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
              dispatch({ type: "TOGGLE_MINIMIZE" });
              if (focusedWindow === id) {
                setFocusedWindow(null);
              }
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
          <div className={styles.loadingOverlay}>
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
          <WindowBody state={state} />
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
            })}
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
            })}
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
            })}
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
            })}
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
            })}
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
            })}
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
            })}
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
            })}
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
          })}
        >
          ⟋
        </div>
      )}
    </div>
  );
}

function createResizeEvent<T>(
  cb: (e: MouseEvent | TouchEvent, delta: { x: number; y: number }) => void
): { onMouseDown: React.MouseEventHandler<T>; onTouchStart: React.TouchEventHandler<T> } {
  const handleStart = (e: MouseEvent | TouchEvent) => {
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
