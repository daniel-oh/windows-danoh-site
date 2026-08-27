import { contextMenuAtom } from "@/state/contextMenu";
import { useAtom } from "jotai";
import { useEffect, useLayoutEffect, useRef } from "react";
import styles from "./ContextMenu.module.css";

export function ContextMenu() {
  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);
  const menuRef = useRef<HTMLDivElement>(null);
  // Where focus goes back to when the menu closes — without this,
  // keyboard users are stranded on <body> after Escape.
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Any click closes the menu, including a click on one of its items
    // (the item's own handler has already run by the time this bubbles).
    const handleClick = () => {
      setContextMenu(null);
    };
    // touchstart fires BEFORE the tap's click. Closing on a touch inside
    // the menu unmounted the item mid-tap and let the click fall through
    // to whatever sat underneath (on phones: a desktop icon, which opens
    // on a single tap). Only a touch outside the menu dismisses it.
    const handleTouchStart = (e: TouchEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleTouchStart);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, [setContextMenu]);

  // role="menu" promises keyboard semantics: focus the first item on
  // open, arrows move between items, Escape closes and restores focus.
  // The capture-phase Escape listener also keeps the OS-level handler
  // (which closes the focused WINDOW) from firing while a menu is up.
  useEffect(() => {
    if (!contextMenu) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    // Container focus, not first-item focus — same reasoning as the
    // Start menu: keyboard works immediately, but the focus box only
    // appears once the user navigates.
    menuRef.current?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setContextMenu(null);
        triggerRef.current?.focus();
        return;
      }
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
      if (e.key === "ArrowDown") next = idx === -1 ? 0 : (idx + 1) % items.length;
      else if (e.key === "ArrowUp")
        next = idx === -1 ? items.length - 1 : (idx - 1 + items.length) % items.length;
      else if (e.key === "Home") next = 0;
      else next = items.length - 1;
      items[next].focus();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [contextMenu, setContextMenu]);

  // Keep the menu on-screen. A right-click near the right edge, or a
  // long-press in the bottom-right of a phone, would otherwise spill
  // the menu off the viewport. Runs before paint so there's no jump.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!contextMenu || !el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    let nx = contextMenu.x;
    let ny = contextMenu.y;
    if (nx + rect.width > window.innerWidth - pad) {
      nx = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (ny + rect.height > window.innerHeight - pad) {
      ny = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    el.style.left = `${nx}px`;
    el.style.top = `${ny}px`;
  }, [contextMenu]);

  if (!contextMenu) return null;

  const { x, y, items } = contextMenu;

  return (
    <div
      ref={menuRef}
      tabIndex={-1}
      className="window"
      style={{
        position: "absolute",
        top: y,
        left: x,
        zIndex: 1000,
        outline: "none",
      }}
    >
      <div className={styles.contextMenu} role="menu" aria-label="Context menu">
        {items.map((item, index) => (
          <button key={index} role="menuitem" className="menu-item" onClick={item.onClick}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
