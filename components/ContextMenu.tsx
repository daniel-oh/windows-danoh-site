import { contextMenuAtom } from "@/state/contextMenu";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import styles from "./ContextMenu.module.css";

export function ContextMenu() {
  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);
  const menuRef = useRef<HTMLDivElement>(null);
  // Where focus goes back to when the menu closes — without this,
  // keyboard users are stranded on <body> after Escape.
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleClick);
    };
  }, [setContextMenu]);

  // role="menu" promises keyboard semantics: focus the first item on
  // open, arrows move between items, Escape closes and restores focus.
  // The capture-phase Escape listener also keeps the OS-level handler
  // (which closes the focused WINDOW) from firing while a menu is up.
  useEffect(() => {
    if (!contextMenu) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();

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
      if (e.key === "ArrowDown") next = (idx + 1) % items.length;
      else if (e.key === "ArrowUp")
        next = (idx - 1 + items.length) % items.length;
      else if (e.key === "Home") next = 0;
      else next = items.length - 1;
      items[next].focus();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  const { x, y, items } = contextMenu;

  return (
    <div
      ref={menuRef}
      className="window"
      style={{
        position: "absolute",
        top: y,
        left: x,
        zIndex: 1000,
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
