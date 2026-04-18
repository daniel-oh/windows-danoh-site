"use client";

import { memo } from "react";
import styles from "./OS.module.css";
import cx from "classnames";
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import { focusedWindowAtom } from "@/state/focusedWindow";
import { windowsListAtom } from "@/state/windowsList";
import { windowAtomFamily } from "@/state/window";
import { createWindow } from "@/lib/createWindow";
import { Window } from "./Window";
import { startMenuOpenAtom } from "@/state/startMenu";
import { Desktop } from "./Desktop";
import { DESKTOP_URL_KEY, registryAtom } from "@/state/registry";
import { ContextMenu } from "./ContextMenu";
import { useActions } from "@/lib/actions/ActionsProvider";
import Image from "next/image";
import { initState } from "@/lib/initState";
import { WIDTH } from "./programs/Welcome";
import { fsManagerAtom } from "@/state/fsManager";
import { burstConfetti } from "@/lib/confetti";

export function OS() {
  // Temp fix lol
  useAtom(fsManagerAtom);
  const [windows] = useAtom(windowsListAtom);
  const setFocusedWindow = useSetAtom(focusedWindowAtom);
  const registry = useAtomValue(registryAtom);

  const publicDesktopUrl = registry[DESKTOP_URL_KEY] ?? "/bg.jpg";

  // Keep latest windows in a ref so listeners don't need to resubscribe
  const windowsRef = useRef(windows);
  windowsRef.current = windows;

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // Don't close the Start menu if the touch/click started INSIDE
      // the menu (user is scrolling its items) or ON the Start button
      // itself (the button's own click handler toggles open/close).
      const insideStartSurface = target.closest(
        "[data-start-menu], [data-start-button]"
      );
      if (!insideStartSurface) {
        getDefaultStore().set(startMenuOpenAtom, false);
      }
      const windowID = windowsRef.current.find((windowId) => {
        const windowElement = document.getElementById(windowId);
        return windowElement && windowElement.contains(target);
      });
      setFocusedWindow(windowID ?? null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Don't steal Escape from inputs/textareas or iframes
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "IFRAME") return;
      const focusedId = getDefaultStore().get(focusedWindowAtom);
      if (!focusedId) return;
      getDefaultStore().set(windowsListAtom, {
        type: "REMOVE",
        payload: focusedId,
      });
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setFocusedWindow]);

  useEffect(() => {
    initState();
  }, []);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        position: "relative",
        backgroundImage: `url(${publicDesktopUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        overflow: "hidden",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <Desktop />
      {windows.map((id) => (
        <Window key={id} id={id} />
      ))}

      <TaskBar />
      <ContextMenu />
    </div>
  );
}

function TaskBar() {
  const windows = useAtomValue(windowsListAtom);
  const [startMenuOpen, setStartMenuOpen] = useAtom(startMenuOpenAtom);
  return (
    <div className={cx("window", styles.taskbar)}>
      <button
        className={styles.startButton}
        aria-label="Start menu"
        data-start-button
        onClick={(e) => {
          e.stopPropagation();
          setStartMenuOpen((v) => !v);
        }}
      >
        Start
      </button>
      {startMenuOpen && <StartMenu />}
      <div className={styles.divider}></div>
      {windows.map((id) => (
        <WindowTaskBarItem key={id} id={id} />
      ))}
      <div className={styles.taskbarSpacer} />
      <LogoEasterEgg />
    </div>
  );
}

function LogoEasterEgg() {
  const clicksRef = useRef<number[]>([]);
  const onClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const now = Date.now();
    // Keep only clicks within the last 2s
    const recent = clicksRef.current.filter((t) => now - t < 2000);
    recent.push(now);
    clicksRef.current = recent;
    if (recent.length >= 3) {
      const rect = e.currentTarget.getBoundingClientRect();
      burstConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      clicksRef.current = [];
    }
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/danoh-logo.svg"
      alt="danoh.com"
      className={styles.taskbarLogo}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      title="Psst — try clicking me three times"
    />
  );
}

function StartMenu() {
  const { logout } = useActions();
  // Suppress synthetic click on a button if the user was scrolling
  // the menu (iOS fires click on touchend even after a small drag).
  // Track touch start Y, flip a ref on touchmove past a threshold,
  // then swallow the click in the capture phase.
  const scrollingRef = useRef(false);
  const touchStartYRef = useRef(0);
  const SCROLL_CANCEL_PX = 8;

  const onMenuTouchStart = (e: React.TouchEvent) => {
    scrollingRef.current = false;
    touchStartYRef.current = e.touches[0]?.clientY ?? 0;
  };
  const onMenuTouchMove = (e: React.TouchEvent) => {
    const dy = Math.abs(
      (e.touches[0]?.clientY ?? 0) - touchStartYRef.current
    );
    if (dy > SCROLL_CANCEL_PX) scrollingRef.current = true;
  };
  const wrap = (cb: () => void) => (e: React.MouseEvent) => {
    if (scrollingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      scrollingRef.current = false;
      return;
    }
    cb();
  };

  // Audited + reordered by focus. Welcome anchors the top; everything
  // else flows from "read / create / play / configure" so visitors
  // aren't staring at a wall of equally-weighted buttons. Display
  // was folded into Settings; Now was removed as redundant with the
  // Welcome program's own Updates tab and the bio hero.
  const entries: { label: string; cb: () => void }[] = [
    // Anchor
    {
      label: "Welcome",
      cb: () => {
        createWindow({
          title: "Welcome to danoh.com",
          program: { type: "welcome" },
          size: { width: WIDTH, height: "auto" },
        });
      },
    },
    // Read
    {
      label: "Blog",
      cb: () => {
        createWindow({
          title: "Blog",
          program: { type: "blog" },
          size: { width: 700, height: 500 },
        });
      },
    },
    {
      label: "Resume",
      cb: () => {
        createWindow({
          title: "Resume - Daniel Oh",
          program: { type: "resume" },
          size: { width: 700, height: 550 },
        });
      },
    },
    // Create
    {
      label: "Run",
      cb: () => {
        createWindow({
          title: "Run",
          program: { type: "run" },
        });
      },
    },
    // Connect
    {
      label: "Mail",
      cb: () => {
        createWindow({
          title: "New Message",
          program: { type: "mail" },
          size: { width: 460, height: 400 },
        });
      },
    },
    {
      label: "Guestbook",
      cb: () => {
        createWindow({
          title: "Guestbook",
          program: { type: "guestbook" },
          size: { width: 440, height: 520 },
        });
      },
    },
    // Play
    {
      label: "Minesweeper",
      cb: () => {
        createWindow({
          title: "Minesweeper",
          program: { type: "minesweeper" },
          size: { width: 280, height: 360 },
          icon: "/icons/pirate-playing.png",
        });
      },
    },
    // Utility
    {
      label: "Explorer",
      cb: () => {
        createWindow({
          title: "Explorer",
          program: { type: "explorer" },
        });
      },
    },
    {
      label: "Settings",
      cb: () => {
        createWindow({
          title: "Settings",
          program: { type: "settings" },
          size: { width: 440, height: 520 },
        });
      },
    },
    // Help
    {
      label: "Shortcuts",
      cb: () => {
        createWindow({
          title: "Keyboard Shortcuts",
          program: { type: "shortcuts" },
          size: { width: 440, height: 380 },
        });
      },
    },
    {
      label: "Report a bug",
      cb: () => {
        window.open("https://forms.gle/ZqG1eLbgBtwadLe4A", "_blank");
      },
    },
  ];

  return (
    <div
      className={cx("window", styles.startMenu)}
      role="menu"
      aria-label="Start menu"
      data-start-menu
      onTouchStart={onMenuTouchStart}
      onTouchMove={onMenuTouchMove}
    >
      {entries.map((entry) => (
        <button
          key={entry.label}
          role="menuitem"
          onClick={wrap(entry.cb)}
        >
          {entry.label}
        </button>
      ))}
      <form style={{ display: "contents" }}>
        <button role="menuitem" formAction={logout}>
          Logout
        </button>
      </form>
    </div>
  );
}

const WindowTaskBarItem = memo(function WindowTaskBarItem({ id }: { id: string }) {
  const [focusedWindow, setFocusedWindow] = useAtom(focusedWindowAtom);
  const [state, dispatch] = useAtom(windowAtomFamily(id));
  return (
    <button
      key={id}
      className={cx(styles.windowButton, {
        [styles.active]: focusedWindow === id,
      })}
      aria-label={state.title}
      onClick={(e) => {
        e.stopPropagation();
        setFocusedWindow(id);
        if (state.status === "minimized") {
          dispatch({ type: "RESTORE" });
        }
      }}
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "256px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        paddingLeft: state.icon ? "8px" : undefined,
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
      <span>{state.title}</span>
    </button>
  );
});
