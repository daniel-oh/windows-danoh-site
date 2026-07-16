import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import styles from "./Desktop.module.css";
import { ProgramEntry, programsAtom } from "@/state/programs";
import defaultIcon from "./assets/window.png";
import blogIcon from "./assets/blog-icon.png";
import resumeIcon from "./assets/resume-icon.png";
import Image from "next/image";
import { createWindow } from "@/lib/createWindow";
import { openProgram } from "@/lib/programs";
import { useCreateContextMenu } from "@/state/contextMenu";
import { useServerPrograms } from "@/lib/useServerPrograms";
import { useEffect, useRef, useState, useCallback } from "react";
import cx from "classnames";
import { useIsMobile } from "@/lib/useIsMobile";

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
const MINESWEEPER_ICON_ID = "__minesweeper__";
const RECYCLE_ICON_ID = "__recycle__";

function getDefaultPositions(programs: ProgramEntry[], existing: IconPositions): IconPositions {
  const positions = { ...existing };
  if (!positions[BLOG_ICON_ID]) {
    positions[BLOG_ICON_ID] = { col: 0, row: 0 };
  }
  if (!positions[RESUME_ICON_ID]) {
    positions[RESUME_ICON_ID] = { col: 0, row: 1 };
  }
  if (!positions[MINESWEEPER_ICON_ID]) {
    positions[MINESWEEPER_ICON_ID] = { col: 0, row: 2 };
  }
  const occupied = new Set(
    Object.values(positions).map((p) => `${p.col},${p.row}`)
  );
  const maxRows = typeof window !== "undefined"
    ? Math.floor((window.innerHeight - 80) / getGridSize())
    : 6;

  const placeInFirstFree = (id: string) => {
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < maxRows; row++) {
        const key = `${col},${row}`;
        if (!occupied.has(key)) {
          positions[id] = { col, row };
          occupied.add(key);
          return;
        }
      }
    }
  };

  // The Recycle Bin anchors to the BOTTOM of the first column (like
  // the real desktop) rather than the next free slot — programs seed
  // asynchronously, so "after the programs" would race them and end
  // up above Snake.exe. Placed before the program loop so the slot is
  // reserved in the occupied set.
  if (!positions[RECYCLE_ICON_ID]) {
    const bottomRow = Math.max(4, maxRows - 1);
    positions[RECYCLE_ICON_ID] = { col: 0, row: bottomRow };
    occupied.add(`0,${bottomRow}`);
  }

  // Programs (Snake.exe, anything generated) stack under the built-ins.
  for (const program of programs) {
    if (positions[program.id]) continue;
    placeInFirstFree(program.id);
  }
  return positions;
}

// Persisted: an OS whose whole bit is statefulness shouldn't forget
// where you put your icons on refresh. getOnInit so the first
// drag of a session doesn't clobber the stored layout.
const iconPositionsAtom = atomWithStorage<IconPositions>(
  // v2: key bumped when the default order changed (Recycle Bin last)
  // so recently-stored layouts pick up the new arrangement.
  "danoh_icon_positions_v2",
  {},
  undefined,
  { getOnInit: true }
);

export const Desktop = () => {
  const { programs } = useAtomValue(programsAtom);
  const dispatch = useSetAtom(programsAtom);
  const { fetchPrograms } = useServerPrograms();
  const didSync = useRef(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [iconPositions, setIconPositions] = useAtom(iconPositionsAtom);
  const mobile = useIsMobile();

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
    setIconPositions((prev: IconPositions) => getDefaultPositions(programs, prev));
  }, [programs, setIconPositions]);

  const moveIcon = useCallback((id: string, col: number, row: number) => {
    setIconPositions((prev: IconPositions) => ({ ...prev, [id]: { col, row } }));
  }, [setIconPositions]);

  // Window configs live in the shared PROGRAMS table (lib/programs.ts);
  // these just name which program each desktop icon opens.
  const openBlog = useCallback(() => openProgram("blog"), []);
  const openResume = useCallback(() => openProgram("resume"), []);
  const openMinesweeper = useCallback(() => openProgram("minesweeper"), []);
  const openRecycle = useCallback(() => openProgram("recycle"), []);

  // Right-click / long-press the empty desktop → the classic Win98
  // background menu. createContextMenu wires both the mouse and the
  // 500ms touch long-press, so this is mobile-friendly for free.
  const createContextMenu = useCreateContextMenu();

  // "Arrange Icons" reflows EVERY icon into the canonical column-major
  // layout, which also clears any overlap a drag-drop left behind
  // (dropping onto an occupied cell just stacked them — there was no
  // collision check). Built-ins first, programs stacked under, Recycle
  // Bin anchored to the bottom, same shape as getDefaultPositions but
  // forced rather than fill-the-gaps.
  const arrangeIcons = useCallback(() => {
    const gridSize = getGridSize();
    const maxRows = Math.max(
      4,
      Math.floor((window.innerHeight - 80) / gridSize)
    );
    const positions: IconPositions = {
      [BLOG_ICON_ID]: { col: 0, row: 0 },
      [RESUME_ICON_ID]: { col: 0, row: 1 },
      [MINESWEEPER_ICON_ID]: { col: 0, row: 2 },
      [RECYCLE_ICON_ID]: { col: 0, row: Math.max(4, maxRows - 1) },
    };
    const occupied = new Set(
      Object.values(positions).map((p) => `${p.col},${p.row}`)
    );
    for (const program of programs) {
      let placed = false;
      for (let col = 0; col < 20 && !placed; col++) {
        for (let row = 0; row < maxRows; row++) {
          const k = `${col},${row}`;
          if (!occupied.has(k)) {
            positions[program.id] = { col, row };
            occupied.add(k);
            placed = true;
            break;
          }
        }
      }
    }
    // Replace the whole map (not merge): drops stale entries for
    // deleted programs and guarantees no two icons share a cell.
    setIconPositions(positions);
    setSelectedIcon(null);
  }, [programs, setIconPositions]);

  // "Refresh" re-pulls saved programs from the server, so a program
  // generated in another tab shows up without a full reload — the
  // authentic desktop "Refresh", with an actual job to do.
  const refreshPrograms = useCallback(() => {
    fetchPrograms().then((serverPrograms) => {
      if (!serverPrograms || !Array.isArray(serverPrograms)) return;
      for (const sp of serverPrograms) {
        if (!programs.some((p) => p.id === sp.id)) {
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
  }, [programs, fetchPrograms, dispatch]);

  const desktopMenu = createContextMenu([
    { label: "Arrange Icons", onClick: arrangeIcons },
    { label: "Refresh", onClick: refreshPrograms },
  ]);

  // Arrow keys move focus between desktop icons so keyboard-only
  // visitors can navigate without Tab-through-every-UI-control. Home /
  // End jump to the first / last icon. Enter / Space is already handled
  // natively by each BuiltInIcon / ProgramIcon button. Horizontal and
  // vertical both step through the flat DOM order because the grid is
  // dynamic — a layered roving-tabindex system would fight the existing
  // drag-drop placement code.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const host = e.currentTarget;
    const icons = Array.from(
      host.querySelectorAll<HTMLButtonElement>(`button.${styles.programIcon}`)
    );
    if (icons.length === 0) return;
    const active = document.activeElement;
    const currentIndex = icons.findIndex((b) => b === active);
    let next = 0;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = icons.length - 1;
    else if (currentIndex < 0) next = 0;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      next = (currentIndex - 1 + icons.length) % icons.length;
    } else {
      next = (currentIndex + 1) % icons.length;
    }
    e.preventDefault();
    icons[next]?.focus();
  };

  return (
    <div
      className={styles.desktop}
      role="main"
      onClick={() => setSelectedIcon(null)}
      onKeyDown={onKeyDown}
      // Background menu only — icons' own onContextMenu stopPropagation,
      // so a right-click on an icon never reaches here. For touch the
      // icon long-press doesn't stopPropagation, so guard on
      // target===currentTarget: only a press on the bare desktop (not
      // an icon button) starts the background long-press timer.
      onContextMenu={desktopMenu.onContextMenu}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) desktopMenu.onTouchStart?.(e);
      }}
      onTouchEnd={desktopMenu.onTouchEnd}
      onTouchMove={desktopMenu.onTouchMove}
    >
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
      <BuiltInIcon
        id={MINESWEEPER_ICON_ID}
        name="Minesweeper"
        icon="/icons/minesweeper-tile.png"
        onOpen={openMinesweeper}
        isSelected={selectedIcon === MINESWEEPER_ICON_ID}
        onSelect={() => setSelectedIcon(MINESWEEPER_ICON_ID)}
        position={iconPositions[MINESWEEPER_ICON_ID] || { col: 0, row: 2 }}
        onMove={(col, row) => moveIcon(MINESWEEPER_ICON_ID, col, row)}
        mobile={mobile}
      />
      <BuiltInIcon
        id={RECYCLE_ICON_ID}
        name="Recycle Bin"
        icon="/icons/recycle-bin.png"
        onOpen={openRecycle}
        isSelected={selectedIcon === RECYCLE_ICON_ID}
        onSelect={() => setSelectedIcon(RECYCLE_ICON_ID)}
        position={iconPositions[RECYCLE_ICON_ID] || { col: 0, row: 3 }}
        onMove={(col, row) => moveIcon(RECYCLE_ICON_ID, col, row)}
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

// Shared desktop icon: owns the drag-drop + click/double-click state
// machine and the button render. The two variants below differ only in
// their context-menu items, icon source/style, and open action — this
// is where the ~160 lines of duplicated drag logic that used to live in
// both ProgramIcon and BuiltInIcon now live once.
type ContextItem = { label: string; onClick: () => void };

function DesktopIcon({
  name,
  iconSrc,
  iconStyle,
  onOpen,
  isSelected,
  onSelect,
  position,
  onMove: onMoveIcon,
  mobile,
  contextItems,
}: {
  name: string;
  iconSrc: typeof defaultIcon | string;
  iconStyle?: React.CSSProperties;
  onOpen: () => void;
  isSelected: boolean;
  onSelect: () => void;
  position: IconPosition;
  onMove: (col: number, row: number) => void;
  mobile: boolean;
  contextItems: ContextItem[];
}) {
  const createContextMenu = useCreateContextMenu();
  const contextMenuHandlers = createContextMenu(contextItems);
  const buttonRef = useRef<HTMLButtonElement>(null);
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
    // Keyboard activation (Enter/Space) reports detail === 0; on mobile a
    // single tap opens. Both open immediately — the select-then-open
    // double-click is a mouse-only affordance, and routing keyboard users
    // through it would force a double-Enter to launch a program (WCAG
    // 2.1.1).
    if (mobile || e.detail === 0) {
      onOpen();
      return;
    }
    // Desktop mouse: double-click opens, single click selects.
    const now = Date.now();
    if (now - lastClickRef.current < DOUBLE_CLICK_MS) {
      onOpen();
      lastClickRef.current = 0;
    } else {
      onSelect();
      // onMouseDown preventDefault (to suppress native drag) also blocks
      // the icon from taking focus, so after a click activeElement is
      // <body> and the desktop's arrow-key nav restarts from the first
      // icon. Focus the icon explicitly so roving nav continues from it.
      buttonRef.current?.focus();
      lastClickRef.current = now;
    }
  };

  const startDrag = (startX: number, startY: number, isTouch: boolean) => {
    const gridSize = mobile ? GRID_MOBILE : GRID;
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
      // Brief delay so the click that fires on mouseup/touchend after a
      // drag doesn't read as a select/open.
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
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onPointerMove(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      onEnd(t?.clientX ?? startX, t?.clientY ?? startY);
    };

    const cleanup = () => {
      // removeEventListener on a never-added listener is a no-op, so the
      // unconditional removals here are safe whether this was a mouse or
      // a touch drag.
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("blur", cancel);
      cleanupRef.current = null;
    };

    cleanupRef.current = cleanup;
    window.addEventListener("blur", cancel);
    if (isTouch) {
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onTouchEnd);
    } else {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
  };

  // Derive the grid from the reactive `mobile` prop, NOT a raw
  // getGridSize() window read. getGridSize() returns 96 server-side
  // (window undefined) and 88 on a phone, so SSR'd built-in icons kept
  // 96 while the async-seeded Snake.exe rendered at 88 — mismatched
  // grids that overlapped (Snake's logo painted over Minesweeper's
  // label). `mobile` updates on hydration and re-renders every icon
  // together, so they always share one grid.
  const gridSize = mobile ? GRID_MOBILE : GRID;
  const basePos = gridToPixels(position.col, position.row, gridSize);
  const pixelPos = dragging && dragOffset
    ? { x: basePos.x + dragOffset.x, y: basePos.y + dragOffset.y }
    : basePos;

  return (
    <button
      ref={buttonRef}
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
      onContextMenu={contextMenuHandlers.onContextMenu}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.preventDefault();
          startDrag(e.clientX, e.clientY, false);
        }
      }}
      onTouchStart={(e) => {
        // Start drag tracking AND the context-menu long-press timer.
        // Drag only activates past the movement threshold, so a
        // stationary long-press still opens the context menu.
        const t = e.touches[0];
        if (t) startDrag(t.clientX, t.clientY, true);
        contextMenuHandlers.onTouchStart?.(e);
      }}
      onTouchEnd={contextMenuHandlers.onTouchEnd}
      onTouchMove={contextMenuHandlers.onTouchMove}
    >
      <Image
        unoptimized
        src={iconSrc}
        alt={name}
        width={24}
        height={24}
        draggable={false}
        style={iconStyle}
      />
      <div className={styles.programName}>{name}</div>
    </button>
  );
}

// A generated/saved program's icon: opens the iframe, Run + Delete menu.
function ProgramIcon({
  program,
  isSelected,
  onSelect,
  position,
  onMove,
  mobile,
}: {
  program: ProgramEntry;
  isSelected: boolean;
  onSelect: () => void;
  position: IconPosition;
  onMove: (col: number, row: number) => void;
  mobile: boolean;
}) {
  const dispatch = useSetAtom(programsAtom);
  const { deleteProgram } = useServerPrograms();

  const runProgram = useCallback(() => {
    createWindow({
      title: program.name,
      program: { type: "iframe", programID: program.id },
      icon: program.icon ?? undefined,
      size: { width: 700, height: 550 },
    });
  }, [program]);

  return (
    <DesktopIcon
      name={program.name}
      iconSrc={program.icon ?? defaultIcon}
      onOpen={runProgram}
      isSelected={isSelected}
      onSelect={onSelect}
      position={position}
      onMove={onMove}
      mobile={mobile}
      contextItems={[
        { label: "Run", onClick: runProgram },
        {
          label: "Delete",
          onClick: () => {
            dispatch({ type: "REMOVE_PROGRAM", payload: program.name });
            deleteProgram(program.id);
          },
        },
      ]}
    />
  );
}

// A built-in icon (Blog, Resume, Minesweeper, Recycle): opens via the
// passed callback, single Open menu item. Non-default raster icons get
// smooth scaling + a slight radius; the pixel-art default stays crisp.
function BuiltInIcon({
  name,
  icon,
  onOpen,
  isSelected,
  onSelect,
  position,
  onMove,
  mobile,
}: {
  id: string;
  name: string;
  icon?: typeof defaultIcon | string;
  onOpen: () => void;
  isSelected: boolean;
  onSelect: () => void;
  position: IconPosition;
  onMove: (col: number, row: number) => void;
  mobile: boolean;
}) {
  return (
    <DesktopIcon
      name={name}
      iconSrc={icon || defaultIcon}
      iconStyle={icon ? { imageRendering: "auto", borderRadius: 4 } : undefined}
      onOpen={onOpen}
      isSelected={isSelected}
      onSelect={onSelect}
      position={position}
      onMove={onMove}
      mobile={mobile}
      contextItems={[{ label: "Open", onClick: onOpen }]}
    />
  );
}
