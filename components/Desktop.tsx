import { useAtomValue, useSetAtom } from "jotai";
import styles from "./Desktop.module.css";
import { ProgramEntry, programsAtom } from "@/state/programs";
import defaultIcon from "./assets/window.png";
import blogIcon from "./assets/blog-icon.png";
import resumeIcon from "./assets/resume-icon.png";
import Image from "next/image";
import { createWindow } from "@/lib/createWindow";
import { useCreateContextMenu } from "@/state/contextMenu";
import { useServerPrograms } from "@/lib/useServerPrograms";
import { useEffect, useRef, useState, useCallback } from "react";
import cx from "classnames";
import { isMobile } from "@/lib/isMobile";

const GRID = 96;
const GRID_MOBILE = 88;
const PADDING = 12;
const DRAG_THRESHOLD = 8;
const DOUBLE_CLICK_MS = 400;

function getGridSize() {
  if (typeof window === "undefined") return GRID;
  return window.innerWidth < 768 ? GRID_MOBILE : GRID;
}

function snapToGrid(x: number, y: number, gridSize: number) {
  return {
    col: Math.max(0, Math.round((x - PADDING) / gridSize)),
    row: Math.max(0, Math.round((y - PADDING) / gridSize)),
  };
}

function gridToPixels(col: number, row: number, gridSize: number) {
  return {
    x: PADDING + col * gridSize,
    y: PADDING + row * gridSize,
  };
}

type IconPosition = { col: number; row: number };
type IconPositions = Record<string, IconPosition>;

const BLOG_ICON_ID = "__blog__";
const RESUME_ICON_ID = "__resume__";

function getDefaultPositions(programs: ProgramEntry[], existing: IconPositions): IconPositions {
  const positions = { ...existing };
  if (!positions[BLOG_ICON_ID]) {
    positions[BLOG_ICON_ID] = { col: 0, row: 0 };
  }
  if (!positions[RESUME_ICON_ID]) {
    positions[RESUME_ICON_ID] = { col: 0, row: 1 };
  }
  const occupied = new Set(
    Object.values(positions).map((p) => `${p.col},${p.row}`)
  );
  const maxRows = typeof window !== "undefined"
    ? Math.floor((window.innerHeight - 80) / getGridSize())
    : 6;

  for (const program of programs) {
    if (positions[program.id]) continue;
    let placed = false;
    for (let col = 0; col < 20 && !placed; col++) {
      for (let row = 0; row < maxRows && !placed; row++) {
        const key = `${col},${row}`;
        if (!occupied.has(key)) {
          positions[program.id] = { col, row };
          occupied.add(key);
          placed = true;
        }
      }
    }
  }
  return positions;
}

export const Desktop = () => {
  const { programs } = useAtomValue(programsAtom);
  const dispatch = useSetAtom(programsAtom);
  const { fetchPrograms } = useServerPrograms();
  const didSync = useRef(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [iconPositions, setIconPositions] = useState<IconPositions>({});
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobile());
  }, []);

  useEffect(() => {
    if (didSync.current) return;
    didSync.current = true;
    fetchPrograms().then((serverPrograms) => {
      if (!serverPrograms || !Array.isArray(serverPrograms)) return;
      for (const sp of serverPrograms) {
        const exists = programs.some((p) => p.id === sp.id);
        if (!exists) {
          dispatch({
            type: "ADD_PROGRAM",
            payload: {
              id: sp.id,
              name: sp.name,
              prompt: sp.prompt,
              code: sp.code ?? undefined,
              icon: sp.icon ?? undefined,
            },
          });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIconPositions((prev) => getDefaultPositions(programs, prev));
  }, [programs]);

  const moveIcon = useCallback((id: string, col: number, row: number) => {
    setIconPositions((prev) => ({ ...prev, [id]: { col, row } }));
  }, []);

  const openBlog = useCallback(() => {
    createWindow({
      title: "Blog",
      program: { type: "blog" },
      size: { width: 700, height: 500 },
    });
  }, []);

  const openResume = useCallback(() => {
    createWindow({
      title: "Resume - Daniel Oh",
      program: { type: "resume" },
      size: { width: 700, height: 550 },
    });
  }, []);

  return (
    <div className={styles.desktop} role="main" onClick={() => setSelectedIcon(null)}>
      <BuiltInIcon
        id={BLOG_ICON_ID}
        name="Blog"
        icon={blogIcon}
        onOpen={openBlog}
        isSelected={selectedIcon === BLOG_ICON_ID}
        onSelect={() => setSelectedIcon(BLOG_ICON_ID)}
        position={iconPositions[BLOG_ICON_ID] || { col: 0, row: 0 }}
        onMove={(col, row) => moveIcon(BLOG_ICON_ID, col, row)}
        mobile={mobile}
      />
      <BuiltInIcon
        id={RESUME_ICON_ID}
        name="Resume"
        icon={resumeIcon}
        onOpen={openResume}
        isSelected={selectedIcon === RESUME_ICON_ID}
        onSelect={() => setSelectedIcon(RESUME_ICON_ID)}
        position={iconPositions[RESUME_ICON_ID] || { col: 0, row: 1 }}
        onMove={(col, row) => moveIcon(RESUME_ICON_ID, col, row)}
        mobile={mobile}
      />
      {programs.map((program) => (
        <ProgramIcon
          key={program.name}
          program={program}
          isSelected={selectedIcon === program.id}
          onSelect={() => setSelectedIcon(program.id)}
          position={iconPositions[program.id] || { col: 0, row: 0 }}
          onMove={(col, row) => moveIcon(program.id, col, row)}
          mobile={mobile}
        />
      ))}
    </div>
  );
};

function ProgramIcon({
  program,
  isSelected,
  onSelect,
  position,
  onMove: onMoveIcon,
  mobile,
}: {
  program: ProgramEntry;
  isSelected: boolean;
  onSelect: () => void;
  position: IconPosition;
  onMove: (col: number, row: number) => void;
  mobile: boolean;
}) {
  const createContextMenu = useCreateContextMenu();
  const dispatch = useSetAtom(programsAtom);
  const { deleteProgram } = useServerPrograms();
  const lastClickRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const runProgram = useCallback(() => {
    createWindow({
      title: program.name,
      program: { type: "iframe", programID: program.id },
      icon: program.icon ?? undefined,
      size: { width: 700, height: 550 },
    });
  }, [program]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current) return;

    if (mobile) {
      // Mobile: single tap opens
      runProgram();
    } else {
      // Desktop: double-click opens, single click selects
      const now = Date.now();
      if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
        runProgram();
        lastClickRef.current = 0;
      } else {
        onSelect();
        lastClickRef.current = now;
      }
    }
  };

  const startDrag = (startX: number, startY: number, isTouch: boolean) => {
    const gridSize = getGridSize();
    const origin = gridToPixels(position.col, position.row, gridSize);
    isDraggingRef.current = false;

    const onPointerMove = (moveX: number, moveY: number) => {
      const dx = moveX - startX;
      const dy = moveY - startY;

      if (!isDraggingRef.current && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        setDragging(true);
        onSelect();
      }

      if (isDraggingRef.current) {
        setDragOffset({ x: dx, y: dy });
      }
    };

    const onEnd = (endX: number, endY: number) => {
      cleanup();
      if (isDraggingRef.current) {
        const dx = endX - startX;
        const dy = endY - startY;
        const snapped = snapToGrid(origin.x + dx, origin.y + dy, gridSize);
        onMoveIcon(snapped.col, snapped.row);
      }
      setDragging(false);
      setDragOffset(null);
      setTimeout(() => { isDraggingRef.current = false; }, 50);
    };

    const cancel = () => {
      cleanup();
      setDragging(false);
      setDragOffset(null);
      isDraggingRef.current = false;
    };

    let onMouseMove: ((e: MouseEvent) => void) | null = null;
    let onMouseUp: ((e: MouseEvent) => void) | null = null;
    let onTouchMoveHandler: ((e: TouchEvent) => void) | null = null;
    let onTouchEndHandler: ((e: TouchEvent) => void) | null = null;

    const cleanup = () => {
      if (onMouseMove) window.removeEventListener("mousemove", onMouseMove);
      if (onMouseUp) window.removeEventListener("mouseup", onMouseUp);
      if (onTouchMoveHandler) window.removeEventListener("touchmove", onTouchMoveHandler);
      if (onTouchEndHandler) window.removeEventListener("touchend", onTouchEndHandler);
      window.removeEventListener("blur", cancel);
      cleanupRef.current = null;
    };

    cleanupRef.current = cleanup;
    window.addEventListener("blur", cancel);

    if (isTouch) {
      onTouchMoveHandler = (e: TouchEvent) => onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      onTouchEndHandler = (e: TouchEvent) => onEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      window.addEventListener("touchmove", onTouchMoveHandler);
      window.addEventListener("touchend", onTouchEndHandler);
    } else {
      onMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
      onMouseUp = (e: MouseEvent) => onEnd(e.clientX, e.clientY);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
  };

  const gridSize = getGridSize();
  const basePos = gridToPixels(position.col, position.row, gridSize);
  const pixelPos = dragging && dragOffset
    ? { x: basePos.x + dragOffset.x, y: basePos.y + dragOffset.y }
    : basePos;

  const contextMenuHandlers = createContextMenu([
    { label: "Run", onClick: runProgram },
    {
      label: "Delete",
      onClick: () => {
        dispatch({ type: "REMOVE_PROGRAM", payload: program.name });
        deleteProgram(program.id);
      },
    },
  ]);

  return (
    <button
      className={cx(styles.programIcon, {
        [styles.selected]: isSelected,
        [styles.dragging]: dragging,
      })}
      style={{
        position: "absolute",
        left: pixelPos.x,
        top: pixelPos.y,
        width: gridSize,
        height: gridSize,
      }}
      aria-label={`Open ${program.name}`}
      onContextMenu={contextMenuHandlers.onContextMenu}
      onClick={handleClick}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.preventDefault();
          startDrag(e.clientX, e.clientY, false);
        }
      }}
      onTouchStart={(e) => {
        // Start drag tracking on touch — context menu long-press
        // will still work because drag only activates after movement
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY, true);
        // Also let context menu handler track for long-press
        contextMenuHandlers.onTouchStart?.(e);
      }}
      onTouchEnd={contextMenuHandlers.onTouchEnd}
      onTouchMove={contextMenuHandlers.onTouchMove}
    >
      <Image
        unoptimized
        src={program.icon ?? defaultIcon}
        alt={program.name}
        width={24}
        height={24}
        draggable={false}
      />
      <div className={styles.programName}>{program.name}</div>
    </button>
  );
}

function BuiltInIcon({
  id: _id,
  name,
  icon,
  onOpen,
  isSelected,
  onSelect,
  position,
  onMove: onMoveIcon,
  mobile,
}: {
  id: string;
  name: string;
  icon?: typeof defaultIcon;
  onOpen: () => void;
  isSelected: boolean;
  onSelect: () => void;
  position: IconPosition;
  onMove: (col: number, row: number) => void;
  mobile: boolean;
}) {
  const lastClickRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDraggingRef.current) return;
    if (mobile) {
      onOpen();
    } else {
      const now = Date.now();
      if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
        onOpen();
        lastClickRef.current = 0;
      } else {
        onSelect();
        lastClickRef.current = now;
      }
    }
  };

  const startDrag = (startX: number, startY: number) => {
    const gridSize = getGridSize();
    const origin = gridToPixels(position.col, position.row, gridSize);
    isDraggingRef.current = false;

    const onPointerMove = (moveX: number, moveY: number) => {
      const dx = moveX - startX;
      const dy = moveY - startY;
      if (!isDraggingRef.current && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        setDragging(true);
        onSelect();
      }
      if (isDraggingRef.current) {
        setDragOffset({ x: dx, y: dy });
      }
    };

    const onEnd = (endX: number, endY: number) => {
      cleanup();
      if (isDraggingRef.current) {
        const dx = endX - startX;
        const dy = endY - startY;
        const snapped = snapToGrid(origin.x + dx, origin.y + dy, gridSize);
        onMoveIcon(snapped.col, snapped.row);
      }
      setDragging(false);
      setDragOffset(null);
      setTimeout(() => { isDraggingRef.current = false; }, 50);
    };

    const cancel = () => {
      cleanup();
      setDragging(false);
      setDragOffset(null);
      isDraggingRef.current = false;
    };

    const onMouseMove = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const onMouseUp = (e: MouseEvent) => onEnd(e.clientX, e.clientY);

    const cleanup = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", cancel);
      cleanupRef.current = null;
    };

    cleanupRef.current = cleanup;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("blur", cancel);
  };

  const gridSize = getGridSize();
  const basePos = gridToPixels(position.col, position.row, gridSize);
  const pixelPos = dragging && dragOffset
    ? { x: basePos.x + dragOffset.x, y: basePos.y + dragOffset.y }
    : basePos;

  return (
    <button
      className={cx(styles.programIcon, {
        [styles.selected]: isSelected,
        [styles.dragging]: dragging,
      })}
      style={{
        position: "absolute",
        left: pixelPos.x,
        top: pixelPos.y,
        width: gridSize,
        height: gridSize,
      }}
      aria-label={`Open ${name}`}
      onClick={handleClick}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.preventDefault();
          startDrag(e.clientX, e.clientY);
        }
      }}
    >
      <Image
        unoptimized
        src={icon || defaultIcon}
        alt={name}
        width={24}
        height={24}
        draggable={false}
        style={icon ? { imageRendering: "auto", borderRadius: 4 } : undefined}
      />
      <div className={styles.programName}>{name}</div>
    </button>
  );
}
