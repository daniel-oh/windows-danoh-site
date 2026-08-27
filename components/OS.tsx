"use client";

import { Fragment, memo, useState } from "react";
import styles from "./OS.module.css";
import cx from "classnames";
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { focusedWindowAtom } from "@/state/focusedWindow";
import { windowsListAtom } from "@/state/windowsList";
import { windowAtomFamily, type WindowState } from "@/state/window";
import { Window } from "./Window";
import { startMenuOpenAtom } from "@/state/startMenu";
import { Desktop } from "./Desktop";
import { DESKTOP_URL_KEY, registryAtom } from "@/state/registry";
import { ContextMenu } from "./ContextMenu";
import { useActions } from "@/lib/actions/ActionsProvider";
import { initState } from "@/lib/initState";
import { openProgram } from "@/lib/programs";
import { fsManagerAtom } from "@/state/fsManager";
import { burstConfetti } from "@/lib/confetti";
import { alert } from "@/lib/alert";
import { BootScreen } from "./boot/BootScreen";
import { Screensaver } from "./Screensaver";
import { settingsAtom } from "@/state/settings";
import { isStartupSoundOn } from "@/lib/startupSound";

// Validate the (cross-program-writable) wallpaper URL before it reaches
// an inline CSS url(). Rejects anything that could break out of the
// quoted url() or isn't a sensible image source; falls back to the
// default wallpaper.
function safeWallpaperUrl(raw: unknown): string {
  const FALLBACK = "/bg.jpg";
  if (typeof raw !== "string" || raw.length > 4096) return FALLBACK;
  if (/["\\\n\r]/.test(raw)) return FALLBACK;
  if (
    /^https:\/\//i.test(raw) ||
    /^blob:/i.test(raw) ||
    /^data:image\//i.test(raw) ||
    (raw.startsWith("/") && !raw.startsWith("//"))
  ) {
    return raw;
  }
  return FALLBACK;
}

export function OS({ staticIntro }: { staticIntro?: React.ReactNode }) {
  // Eager-subscribe to fsManagerAtom so the async chain
  // (IndexedDB open → root handle → mounted dirs → FsManager init)
  // starts on OS mount rather than lazily on the first getFsManager()
  // call from a child program. Without this, opening Explorer or any
  // program that touches the virtual FS pays the full cold-start
  // latency on its first render. The returned value is intentionally
  // unused — this is a subscription-for-side-effect.
  useAtom(fsManagerAtom);
  const [windows] = useAtom(windowsListAtom);
  const setFocusedWindow = useSetAtom(focusedWindowAtom);
  const registry = useAtomValue(registryAtom);

  // public_desktop_url is a shared registry key any generated app can
  // write (Iframe.tsx allows public_ keys cross-program), and it lands
  // in an inline CSS url() below. React doesn't sanitize CSS value
  // strings, so an unvalidated value could break out of url(...) and
  // inject extra declarations. Validate to a safe image source.
  const publicDesktopUrl = safeWallpaperUrl(registry[DESKTOP_URL_KEY]);
  const { crt } = useAtomValue(settingsAtom);

  // Wallpaper parallax: the background sits on its own slightly
  // oversized layer and drifts a few pixels against the cursor,
  // lerped on rAF. Desktop pointers only; reduced-motion gets a
  // static wallpaper. Cheap depth, no library.
  const parallaxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = parallaxRef.current;
    if (!el) return;
    if (
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -14;
      ty = (e.clientY / window.innerHeight - 0.5) * -10;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const step = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf =
        Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05
          ? requestAnimationFrame(step)
          : 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // The server-rendered intro stays up until the first window opens
  // (initState runs right after hydration), then never comes back —
  // even if the visitor later closes every window. Render-phase state
  // adjustment per the React docs, not an effect.
  const [booted, setBooted] = useState(false);
  if (!booted && windows.length > 0) setBooted(true);

  // Keep latest windows in a ref so listeners don't need to resubscribe.
  // Synced in an effect (not during render) per the react-hooks purity
  // rules; the global listeners only read it from event callbacks,
  // which always run after the commit.
  const windowsRef = useRef(windows);
  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      // Don't close the Start menu if the touch/click started INSIDE
      // the menu (user is scrolling its items) or ON the Start button
      // itself (the button's own click handler toggles open/close).
      const insideStartSurface = target.closest(
        "[data-start-menu], [data-start-button]"
      );
      // Opening/scrolling the Start menu must not blur the current
      // window: real Windows keeps the active window active, and the
      // menu's aria-current="page" active-program hint is computed from
      // the focused window — clearing it here left that hint perpetually
      // empty. So bail before touching focus when the press is on the
      // Start surface.
      if (insideStartSurface) return;
      getDefaultStore().set(startMenuOpenAtom, false);
      // A press on the taskbar (window buttons, clock, logo) is not a
      // press on the desktop: real Windows keeps the active window
      // active. It also lets a taskbar button's click handler trust
      // focusedWindow, which this mousedown would otherwise have just
      // cleared, to decide between "minimize me" and "bring me up".
      if (target.closest("[data-taskbar]")) return;
      const windowID = windowsRef.current.find((windowId) => {
        const windowElement = document.getElementById(windowId);
        return windowElement && windowElement.contains(target);
      });
      setFocusedWindow(windowID ?? null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const store = getDefaultStore();
      // Ctrl+` cycles focus through open windows (Shift reverses) —
      // the desktop's Alt-Tab. Alt+Tab itself belongs to the real OS,
      // and without some window-switching gesture the desktop is
      // single-window-only for keyboard users.
      if (e.key === "`" && e.ctrlKey) {
        e.preventDefault();
        const list = store
          .get(windowsListAtom)
          .filter(
            (id) => store.get(windowAtomFamily(id)).status !== "minimized"
          );
        if (!list.length) return;
        const current = store.get(focusedWindowAtom);
        const idx = current ? list.indexOf(current) : -1;
        const step = e.shiftKey ? -1 : 1;
        const next = list[(idx + step + list.length) % list.length];
        store.set(focusedWindowAtom, next);
        document.getElementById(next)?.focus({ preventScroll: true });
        return;
      }
      // Ctrl+Escape jumps focus to the Start button — the keyboard route
      // out of a focused window down to the taskbar, mirroring the real
      // Windows Ctrl+Esc. Handled before the plain-Escape window-close
      // below so it doesn't also close the focused window.
      if (e.key === "Escape" && e.ctrlKey) {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>("[data-start-button]")
          ?.focus();
        return;
      }
      if (e.key !== "Escape") return;
      // The Start menu swallows Escape first, like the real shell —
      // otherwise Esc would close the focused window underneath it.
      if (store.get(startMenuOpenAtom)) {
        store.set(startMenuOpenAtom, false);
        document
          .querySelector<HTMLButtonElement>("[data-start-button]")
          ?.focus();
        return;
      }
      // Don't steal Escape from form controls, editable text or iframes
      // (Esc on Minesweeper's difficulty <select> closed the game).
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "IFRAME" ||
        active?.isContentEditable
      )
        return;
      const focusedId = store.get(focusedWindowAtom);
      if (!focusedId) return;
      store.set(windowsListAtom, {
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

  // The Win98 startup sound, once per browser session, on the first
  // user gesture (autoplay policy forbids sooner). Off unless the
  // visitor ticked it in Settings, and always skipped for
  // reduced-motion users. The preference is re-read at play time so
  // flipping the toggle before the first gesture counts.
  useEffect(() => {
    // Storage access itself throws under Safari's "Block all cookies";
    // a chime is not worth an error boundary, so treat that as "played".
    const storage = (() => {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    })();
    if (!storage || storage.getItem("danoh_boot_sound")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const playBootSound = () => {
      if (!isStartupSoundOn()) {
        cleanup();
        return;
      }
      try {
        storage.setItem("danoh_boot_sound", "1");
      } catch {
        /* quota / private mode: play anyway, once per mount */
      }
      const audio = new Audio("/start.mp3");
      audio.volume = 0.35;
      audio.play().catch(() => {
        /* blocked or missing — stay silent */
      });
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", playBootSound);
      window.removeEventListener("keydown", playBootSound);
    };
    window.addEventListener("pointerdown", playBootSound);
    window.addEventListener("keydown", playBootSound);
    return cleanup;
  }, []);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100vw",
        position: "relative",
        background: "#008080",
        // clip, NOT hidden: the parallax wallpaper sits at inset:-20 so
        // the root's scrollHeight is 20px taller than the viewport. With
        // "hidden" the root is still a programmatic scroll container, so
        // when a gate input (Run's access-code field) autofocuses on load
        // the browser scrolls it into view — scrolling the desktop, and
        // the taskbar with it, up by 20px. "clip" clips identically but
        // is not scrollable, so focus can never shift the desktop.
        overflow: "clip",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <div
        ref={parallaxRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: -20,
          // Double-quoted; safeWallpaperUrl() already rejects quotes,
          // backslashes, and newlines, so the value can't escape it.
          backgroundImage: `url("${publicDesktopUrl}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          willChange: "transform",
        }}
      />
      <Desktop />
      {!booted && staticIntro}
      {windows.map((id) => (
        <Window key={id} id={id} />
      ))}

      <TaskBar />
      <ContextMenu />
      {crt && <div className={styles.crtOverlay} aria-hidden="true" />}
      <Screensaver />
      <BootScreen />
    </div>
  );
}

function TaskBar() {
  const windows = useAtomValue(windowsListAtom);
  const [startMenuOpen, setStartMenuOpen] = useAtom(startMenuOpenAtom);

  // Arrow-key navigation across the taskbar's own controls (Start,
  // window buttons, logo) — the WAI-ARIA toolbar role promises it, and
  // it mirrors the desktop icons' keyboard nav. Buttons inside the
  // Start menu are excluded: the menu owns its own up/down handling,
  // and the guard (idx < 0 when focus is in the menu) hands arrows back
  // to it. Vertical arrows are left alone for the same reason.
  const onTaskbarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const controls = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button")
    ).filter((b) => !b.closest("#start-menu"));
    if (!controls.length) return;
    const idx = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (idx < 0) return; // focus is in the Start menu, not on a control
    e.preventDefault();
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = controls.length - 1;
    else if (e.key === "ArrowLeft")
      next = (idx - 1 + controls.length) % controls.length;
    else next = (idx + 1) % controls.length;
    controls[next].focus();
  };

  return (
    <div
      className={cx("window", styles.taskbar)}
      role="toolbar"
      aria-label="Taskbar"
      data-taskbar
      onKeyDown={onTaskbarKeyDown}
    >
      <button
        // Stay visually pressed while the menu is open, like the real
        // Win98 Start button (it only looked pressed on mousedown before).
        className={cx(styles.startButton, { [styles.active]: startMenuOpen })}
        aria-label="Start menu"
        aria-haspopup="menu"
        aria-expanded={startMenuOpen}
        aria-controls="start-menu"
        data-start-button
        onClick={(e) => {
          e.stopPropagation();
          setStartMenuOpen((v) => !v);
        }}
      >
        {/* The Win98 flag, like the original Start button. Decorative
         * (the button's aria-label already says "Start menu"). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/win98-start.png" alt="" className={styles.startLogo} />
        Start
      </button>
      {startMenuOpen && <StartMenu />}
      <div className={styles.divider}></div>
      {/* Own strip (not bare flex children): with many windows open the
       * buttons would otherwise shove the clock and logo off the tray.
       * Buttons shrink to a readable floor, then the strip scrolls. */}
      <div className={styles.windowStrip}>
        {windows.map((id) => (
          <WindowTaskBarItem key={id} id={id} />
        ))}
      </div>
      <TaskbarClock />
      <LogoEasterEgg />
    </div>
  );
}

function formatClock() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function subscribeClock(onTick: () => void) {
  const t = setInterval(onTick, 30_000);
  return () => clearInterval(t);
}

// The tray clock — the most-remembered piece of Win98 chrome.
// useSyncExternalStore instead of setState-in-effect: the server
// snapshot is empty (a server-rendered time would be a guaranteed
// hydration mismatch) and the value ticks every 30s after hydration.
function TaskbarClock() {
  const time = useSyncExternalStore(subscribeClock, formatClock, () => "");
  if (!time) return null;
  return (
    <div
      className={styles.taskbarClock}
      // role="timer" gives the aria-label something to attach to — a
      // bare div with aria-label is announced inconsistently.
      role="timer"
      title={new Date().toDateString()}
      aria-label={`Clock: ${time}`}
    >
      {time}
    </div>
  );
}

function LogoEasterEgg() {
  const clicksRef = useRef<number[]>([]);
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
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
    <button
      type="button"
      onClick={onClick}
      className={styles.taskbarLogoButton}
      title="Psst. Try clicking me three times"
      aria-label="danoh.com logo. Try clicking three times"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/danoh-logo.svg" alt="" className={styles.taskbarLogo} />
    </button>
  );
}

function StartMenu() {
  const { logout } = useActions();
  const setStartMenuOpen = useSetAtom(startMenuOpenAtom);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus the menu CONTAINER on open, not the first item: arrow keys
  // and Tab work immediately, but the visible focus box only appears
  // once the user actually starts navigating. Auto-focusing an item
  // painted a ring on "Welcome" the instant the menu opened, which
  // read as a rendering glitch to mouse users.
  useEffect(() => {
    menuRef.current?.focus({ preventScroll: true });
  }, []);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]'
      ) ?? []
    );
    if (!items.length) return;
    e.preventDefault();
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    // idx === -1 means focus is still on the container (menu just
    // opened): Down enters at the top, Up enters at the bottom.
    if (e.key === "ArrowDown") next = idx === -1 ? 0 : (idx + 1) % items.length;
    else if (e.key === "ArrowUp")
      next = idx === -1 ? items.length - 1 : (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else next = items.length - 1;
    items[next].focus();
  };

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
    setStartMenuOpen(false);
    // Entries that open a window get focus from the window's own mount
    // effect. The rest (external links, which open a new tab) would
    // leave focus on <body> once the menu unmounts; hand it back to
    // the Start button so Tab/arrow navigation resumes where it began.
    setTimeout(() => {
      if (document.activeElement === document.body) {
        document
          .querySelector<HTMLButtonElement>("[data-start-button]")
          ?.focus({ preventScroll: true });
      }
    }, 0);
  };

  // Focus leaving the menu closes it. Tab past the last item, or any
  // focus move to something outside the menu and the Start button,
  // used to leave a dead menu open with focus somewhere behind it.
  // relatedTarget is null for non-focusable click targets; the global
  // pointerdown handler already closes the menu for those, and for a
  // new tab (window.open) closing is what we want anyway.
  const onMenuBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as HTMLElement | null;
    if (next?.closest("[data-start-menu], [data-start-button]")) return;
    setStartMenuOpen(false);
  };

  // Resolve the currently-focused window's program type, so the
  // matching Start-menu entry can carry aria-current="page" for
  // screen readers. Recomputed only when the focused window changes;
  // program type doesn't mutate after creation. Reads the atom value
  // via the default store rather than useAtomValue because the id
  // is dynamic and hooks require stable shape.
  const focusedWindowId = useAtomValue(focusedWindowAtom);
  const focusedProgramType: WindowState["program"]["type"] | null =
    useMemo(() => {
      if (!focusedWindowId) return null;
      try {
        const state = getDefaultStore().get(
          windowAtomFamily(focusedWindowId)
        );
        return state.program.type;
      } catch {
        return null;
      }
    }, [focusedWindowId]);

  // Audited + reordered by focus. Welcome anchors the top; everything
  // else flows from "read / create / play / configure" so visitors
  // aren't staring at a wall of equally-weighted buttons. Display
  // was folded into Settings; Now was removed as redundant with the
  // Welcome program's own Updates tab and the bio hero.
  //
  // programType is what the entry's cb opens (matched against the
  // focused window so the active program reads aria-current="page").
  // Omitted for entries that don't open an in-OS window — Report a
  // bug and Privacy are external links.
  const entries: {
    label: string;
    programType?: WindowState["program"]["type"];
    cb: () => void;
    // First entry of a logical group renders an etched separator above
    // it, the way the real Win98 Start menu chunked its sections.
    separatorBefore?: boolean;
  }[] = [
    // Each program opener routes through the shared PROGRAMS table in
    // lib/programs.ts — title/size/icon live there, not inline here.
    // Anchor
    { label: "Welcome", programType: "welcome", cb: () => openProgram("welcome") },
    // Read
    { label: "Blog", programType: "blog", separatorBefore: true, cb: () => openProgram("blog") },
    { label: "Resume", programType: "resume", cb: () => openProgram("resume") },
    // Create
    { label: "Run", programType: "run", separatorBefore: true, cb: () => openProgram("run") },
    // Connect
    { label: "Mail", programType: "mail", cb: () => openProgram("mail") },
    { label: "Guestbook", programType: "guestbook", cb: () => openProgram("guestbook") },
    // Play
    { label: "Minesweeper", programType: "minesweeper", cb: () => openProgram("minesweeper") },
    // Utility
    { label: "Explorer", programType: "explorer", separatorBefore: true, cb: () => openProgram("explorer") },
    { label: "Settings", programType: "settings", cb: () => openProgram("settings") },
    // Help
    { label: "Shortcuts", programType: "shortcuts", separatorBefore: true, cb: () => openProgram("shortcuts") },
    {
      label: "Report a bug",
      cb: () => {
        window.open("https://forms.gle/ZqG1eLbgBtwadLe4A", "_blank");
      },
    },
    {
      label: "Privacy",
      cb: () => {
        window.open("/privacy", "_blank");
      },
    },
    {
      label: "Terms",
      cb: () => {
        window.open("/terms", "_blank");
      },
    },
  ];

  return (
    <div
      id="start-menu"
      ref={menuRef}
      tabIndex={-1}
      className={cx("window", styles.startMenu)}
      role="menu"
      aria-label="Start menu"
      data-start-menu
      onTouchStart={onMenuTouchStart}
      onTouchMove={onMenuTouchMove}
      onKeyDown={onMenuKeyDown}
      onBlur={onMenuBlur}
    >
      {/* Decorative brand strip down the left edge — the Win98 banner,
       * rebadged. aria-hidden so screen readers jump straight to the
       * menu items. */}
      <div className={styles.startBanner} aria-hidden="true">
        <span>
          danoh<span className={styles.tld}>.com</span>
        </span>
      </div>
      <div className={styles.startItems}>
      {entries.map((entry) => {
        // The entry whose programType matches the focused window is
        // the "current page" for screen-reader purposes — visitors
        // exploring the menu hear which program is active.
        const isActive =
          entry.programType !== undefined &&
          entry.programType === focusedProgramType;
        return (
          <Fragment key={entry.label}>
            {entry.separatorBefore && (
              <div role="separator" className={styles.menuSeparator} />
            )}
            <button
              role="menuitem"
              aria-current={isActive ? "page" : undefined}
              onClick={wrap(entry.cb)}
            >
              {entry.label}
            </button>
          </Fragment>
        );
      })}
      <div role="separator" className={styles.menuSeparator} />
      <button role="menuitem" onClick={wrap(() => confirmLogout(logout))}>
        Log Off...
      </button>
      </div>
    </div>
  );
}

// Retro Win98 "Log Off Windows" confirmation. Counts the currently-open
// programs so the visitor knows what's about to close, matching the way
// the real Windows shell used to warn before a shutdown.
//
// The Yes path awaits the Supabase signOut server action, then forces
// a hard navigation to /logout. Server actions called from a bare
// onClick (as opposed to a form's formAction) don't reliably dispatch
// `redirect()` on the client — the signOut runs and cookies clear, but
// the browser stays put. Awaiting + window.location gives us a belt-
// and-suspenders flow that works in both paths.
function confirmLogout(logout: () => Promise<void> | void) {
  const store = getDefaultStore();
  const openCount = store.get(windowsListAtom).length;
  const openLine =
    openCount === 0
      ? "No programs are open."
      : openCount === 1
        ? "1 open program will close."
        : `${openCount} open programs will close.`;
  alert({
    alertId: "LOG_OFF_CONFIRM",
    title: "Log Off Windows",
    message: (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ margin: 0 }}>Are you sure you want to log off?</p>
        <p style={{ margin: 0, fontSize: 11, color: "#444" }}>{openLine}</p>
      </div>
    ),
    actions: [
      {
        label: "No",
        callback: (close) => close(),
      },
      {
        label: "Yes",
        callback: async (close) => {
          close();
          try {
            await logout();
          } catch {
            // NEXT_REDIRECT from the server action throws on some
            // Next versions; let Next's machinery handle that path.
          }
          // If the redirect didn't auto-dispatch, force it. If it
          // did, this lands on the same page and is a no-op.
          window.location.href = "/logout";
        },
      },
    ],
  });
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
      aria-pressed={focusedWindow === id}
      aria-label={
        state.status === "minimized" ? `${state.title}, minimized` : state.title
      }
      title={state.title}
      data-taskbar-for={id}
      onClick={(e) => {
        e.stopPropagation();
        // Win98: the button of the ACTIVE window minimizes it. The
        // minimize path (genie toward this button, then focus handoff
        // to the next window) lives on the title-bar button and reads
        // live element rects, so delegate to it rather than copy it.
        if (focusedWindow === id && state.status !== "minimized") {
          document
            .getElementById(id)
            ?.querySelector<HTMLButtonElement>('button[aria-label="Minimize"]')
            ?.click();
          return;
        }
        setFocusedWindow(id);
        // Put DOM focus in the window too, not just the focus atom:
        // the window's own focus-on-open effect runs on mount only, so
        // without this a keyboard user who restores or switches from
        // the taskbar is left with focus on the taskbar button.
        setTimeout(
          () => document.getElementById(id)?.focus({ preventScroll: true }),
          0
        );
        if (state.status === "minimized") {
          const btnRect = e.currentTarget.getBoundingClientRect();
          dispatch({ type: "RESTORE" });
          // Reverse genie: grow back out of the taskbar button. Runs
          // after React has made the window visible again.
          if (
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ) {
            void import("gsap").then(({ gsap }) => {
              requestAnimationFrame(() => {
                const el = document.getElementById(id);
                if (!el) return;
                const er = el.getBoundingClientRect();
                const v = {
                  x: btnRect.left + btnRect.width / 2 - (er.left + er.width / 2),
                  y: btnRect.top + btnRect.height / 2 - (er.top + er.height / 2),
                  s: 0.04,
                  o: 0.4,
                };
                // Native translate/scale props, hand-written — see the
                // minimize handler in Window.tsx for why.
                gsap.to(v, {
                  x: 0,
                  y: 0,
                  s: 1,
                  o: 1,
                  duration: 0.26,
                  ease: "power3.out",
                  onUpdate: () => {
                    el.style.translate = `${v.x}px ${v.y}px`;
                    el.style.scale = String(v.s);
                    el.style.opacity = String(v.o);
                  },
                  onComplete: () => {
                    el.style.translate = "";
                    el.style.scale = "";
                    el.style.opacity = "";
                  },
                });
              });
            });
          }
        }
      }}
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "256px",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Text only: program icons in the taskbar buttons read as
        * clutter at 16px and drift from the spare Win98 look. The
        * icon still lives on the desktop and the window title bar. */}
      <span>{state.title}</span>
    </button>
  );
});
