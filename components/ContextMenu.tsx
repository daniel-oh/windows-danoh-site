import { contextMenuAtom } from "@/state/contextMenu";
import { useAtom } from "jotai";
import { useEffect } from "react";
import styles from "./ContextMenu.module.css";

export function ContextMenu() {
  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);

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

  if (!contextMenu) return null;

  const { x, y, items } = contextMenu;

  return (
    <div
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
