import { useCallback, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./MenuBar.module.css";
import cx from "classnames";

type Options = OptionGroup[];

type OptionGroup = {
  label: string;
  items: (Option | null)[];
};

type Option = {
  label: string;
  onClick: () => void;
};

export function MenuBar({ options }: { options: Options }) {
  const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(null);
  if (!options.length) return null;

  return (
    <div className={styles.menuBar} role="menubar">
      {options.map((optionGroup) => (
        <MenuBarButton
          key={optionGroup.label}
          optionGroup={optionGroup}
          openMenuLabel={openMenuLabel}
          setOpenMenuLabel={setOpenMenuLabel}
        />
      ))}
    </div>
  );
}

function MenuBarButton({
  optionGroup,
  openMenuLabel,
  setOpenMenuLabel,
}: {
  optionGroup: OptionGroup;
  openMenuLabel: string | null;
  setOpenMenuLabel: (label: string | null) => void;
}) {
  const closeMenu = useCallback(() => {
    setOpenMenuLabel(null);
  }, [setOpenMenuLabel]);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleBlur = () => {
      closeMenu();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("blur", handleBlur);
    };
  }, [closeMenu]);

  // Anchor rect captured at click time, not read from a ref during
  // render — same visual result, and the dropdown position can't go
  // stale mid-render.
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  return (
    <div className={styles.menuBarButtonContainer} ref={ref}>
      <button
        className={cx(styles.menuBarButton, {
          [styles.isOpen]: openMenuLabel === optionGroup.label,
        })}
        aria-haspopup="true"
        aria-expanded={openMenuLabel === optionGroup.label}
        onClick={(e) => {
          setAnchorRect(e.currentTarget.getBoundingClientRect());
          setOpenMenuLabel(
            openMenuLabel === optionGroup.label ? null : optionGroup.label
          );
        }}
      >
        {optionGroup.label}
      </button>
      {openMenuLabel === optionGroup.label && anchorRect &&
        createPortal(
          <MenuBarDropdown
            optionGroup={optionGroup}
            closeMenu={closeMenu}
            anchorRect={anchorRect}
          />,
          document.body
        )
      }
    </div>
  );
}

function MenuBarDropdown({
  optionGroup,
  closeMenu,
  anchorRect,
}: {
  optionGroup: OptionGroup;
  closeMenu: () => void;
  anchorRect: DOMRect;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Where focus returns when the menu closes — the trigger button that
  // held focus when the dropdown mounted. Without this, keyboard users
  // are stranded on <body> after Escape.
  const triggerRef = useRef<HTMLElement | null>(null);

  // role="menu" promises keyboard semantics, but this dropdown portals
  // to document.body — OUTSIDE the window's focus trap — so Tab never
  // reaches it. Mirror ContextMenu: focus the first item on open, arrows
  // move between items, and a capture-phase Escape closes the dropdown.
  // The capture + stopPropagation keeps the OS-level Escape handler (which
  // closes the whole focused WINDOW) from firing while the menu is up.
  useEffect(() => {
    const menuEl = menuRef.current;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const getItems = () =>
      Array.from(
        menuEl?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
      );
    getItems()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      const items = getItems();
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
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      // Restore focus to the trigger when the menu closes by any path
      // (item click, click-away, blur) — but only if focus was still
      // inside the menu, so an outside click that dismissed it keeps its
      // own target focused.
      if (menuEl?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
    };
  }, [closeMenu]);

  return (
    <div
      ref={menuRef}
      className={cx(styles.menuBarDropdown, "window")}
      role="menu"
      style={{
        position: "fixed",
        top: anchorRect.bottom,
        left: anchorRect.left,
      }}
    >
      {optionGroup.items.map(
        (item) =>
          item && (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                item.onClick();
                closeMenu();
              }}
            >
              {item.label}
            </button>
          )
      )}
    </div>
  );
}
