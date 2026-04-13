import { atom, useSetAtom } from "jotai";
import { useRef, useCallback } from "react";

export const contextMenuAtom = atom<{
  x: number;
  y: number;
  items: { label: string; onClick: () => void }[];
} | null>(null);

export function useCreateContextMenu() {
  const setContextMenu = useSetAtom(contextMenuAtom);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const createHandlers = useCallback(
    (items: { label: string; onClick: () => void }[]) => {
      const onContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, items });
      };

      const onTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        timeoutRef.current = setTimeout(() => {
          e.preventDefault();
          setContextMenu({
            x: touch.clientX,
            y: touch.clientY,
            items,
          });
        }, 500);
      };

      const onTouchEnd = () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };

      const onTouchMove = (e: React.TouchEvent) => {
        if (timeoutRef.current && touchStartRef.current) {
          const touch = e.touches[0];
          const dx = touch.clientX - touchStartRef.current.x;
          const dy = touch.clientY - touchStartRef.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > 10) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      };

      return { onContextMenu, onTouchStart, onTouchEnd, onTouchMove };
    },
    [setContextMenu]
  );

  return createHandlers;
}
