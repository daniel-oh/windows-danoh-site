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
import { DEFAULT_THEME, DESKTOP_URL_KEY, THEME_KEY, registryAtom } from "@/state/registry";
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

  const theme = registry[THEME_KEY] === "dark" ? "dark" : DEFAULT_THEME;
  const publicDesktopUrl =
    registry[DESKTOP_URL_KEY] ?? (theme === "dark" ? "" : "/bg.jpg");

  // Apply theme at the <html> level so our scoped dark-mode CSS overrides fire.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }
  }, [theme]);

  // Keep latest windows in a ref so listeners don't need to resubscribe
  const windowsRef = useRef(windows);
  windowsRef.current = windows;

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      getDefaultStore().set(startMenuOpenAtom, false);
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

  const entries: { label: string; cb: () => void }[] = [
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
      label: "Now",
      cb: () => {
        createWindow({
          title: "Now",
          program: { type: "now" },
          size: { width: 520, height: 520 },
        });
      },
    },
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
    {
      label: "Run",
      cb: () => {
        createWindow({
          title: "Run",
          program: { type: "run" },
        });
      },
    },
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
        });
      },
    },
    {
      label: "Display",
      cb: () => {
        createWindow({
          title: "Display",
          program: { type: "display" },
          size: { width: 360, height: 280 },
        });
      },
    },
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
    <div className={cx("window", styles.startMenu)} role="menu" aria-label="Start menu">
      {entries.map((entry) => (
        <button
          key={entry.label}
          role="menuitem"
          onClick={entry.cb}
          onMouseDown={entry.cb}
          onTouchStart={entry.cb}
        >
          {entry.label}
        </button>
      ))}
      <form style={{ display: "contents" }}>
        <button
          role="menuitem"
          formAction={logout}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
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
