"use client";

import { useEffect, useMemo, useState } from "react";

type Cell = {
  mine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
};

type Board = Cell[][];
type Status = "idle" | "playing" | "won" | "lost";

type Difficulty = { label: string; rows: number; cols: number; mines: number };
const DIFFICULTIES: Difficulty[] = [
  { label: "Beginner", rows: 9, cols: 9, mines: 10 },
  { label: "Intermediate", rows: 12, cols: 12, mines: 25 },
  { label: "Expert", rows: 16, cols: 16, mines: 50 },
];

const NUMBER_COLORS = [
  "", // 0 — hidden when blank
  "#0000ff", // 1 blue
  "#007a00", // 2 green
  "#ff0000", // 3 red
  "#000080", // 4 dark blue
  "#800000", // 5 maroon
  "#008080", // 6 teal
  "#000000", // 7 black
  "#808080", // 8 gray
];

function makeEmptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
    }))
  );
}

function placeMines(
  board: Board,
  mineCount: number,
  safeR: number,
  safeC: number
): Board {
  const rows = board.length;
  const cols = board[0].length;
  // clone to avoid mutating
  const next: Board = board.map((row) => row.map((c) => ({ ...c })));

  const totalCells = rows * cols;
  const forbidden = new Set<number>();
  // exclude the clicked cell and its 8 neighbors so the first click
  // reliably opens a region
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = safeR + dr;
      const c = safeC + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        forbidden.add(r * cols + c);
      }
    }
  }

  const candidates: number[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (!forbidden.has(i)) candidates.push(i);
  }
  // Fisher–Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const mines = Math.min(mineCount, candidates.length);
  for (let i = 0; i < mines; i++) {
    const idx = candidates[i];
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    next[r][c].mine = true;
  }

  // compute adjacents
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (next[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < cols &&
            next[nr][nc].mine
          ) {
            count++;
          }
        }
      }
      next[r][c].adjacent = count;
    }
  }

  return next;
}

function floodReveal(board: Board, r: number, c: number): Board {
  const rows = board.length;
  const cols = board[0].length;
  const next: Board = board.map((row) => row.map((c) => ({ ...c })));
  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    const cell = next[cr][cc];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          stack.push([cr + dr, cc + dc]);
        }
      }
    }
  }
  return next;
}

function revealAllMines(board: Board): Board {
  return board.map((row) =>
    row.map((cell) => (cell.mine ? { ...cell, revealed: true } : cell))
  );
}

function countFlags(board: Board): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell.flagged) n++;
  return n;
}

function checkWin(board: Board): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (!cell.mine && !cell.revealed) return false;
    }
  }
  return true;
}

export function Minesweeper() {
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES[0]);
  const [board, setBoard] = useState<Board>(() =>
    makeEmptyBoard(difficulty.rows, difficulty.cols)
  );
  const [status, setStatus] = useState<Status>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [flagMode, setFlagMode] = useState(false);

  // Tick the timer once per second while playing. setInterval is
  // intentional here — we only display whole seconds, so rAF's 60fps
  // would trigger ~59 needless re-renders per second.
  useEffect(() => {
    if (status !== "playing" || startedAt === null) return;
    setElapsedMs(Date.now() - startedAt);
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 500);
    return () => clearInterval(id);
  }, [status, startedAt]);

  const reset = (d: Difficulty = difficulty) => {
    setDifficulty(d);
    setBoard(makeEmptyBoard(d.rows, d.cols));
    setStatus("idle");
    setStartedAt(null);
    setElapsedMs(0);
  };

  const handleReveal = (r: number, c: number) => {
    if (status === "won" || status === "lost") return;
    if (board[r][c].flagged) return;

    let next = board;
    let nextStatus: Status = status;
    let nextStartedAt = startedAt;

    if (status === "idle") {
      next = placeMines(board, difficulty.mines, r, c);
      nextStatus = "playing";
      nextStartedAt = Date.now();
    }

    const cell = next[r][c];
    if (cell.mine) {
      next = revealAllMines(next).map((row, rr) =>
        row.map((cc, col) =>
          rr === r && col === c ? { ...cc, revealed: true } : cc
        )
      );
      nextStatus = "lost";
    } else {
      next = floodReveal(next, r, c);
      if (checkWin(next)) nextStatus = "won";
    }

    setBoard(next);
    setStatus(nextStatus);
    setStartedAt(nextStartedAt);
  };

  const handleFlag = (r: number, c: number) => {
    if (status === "won" || status === "lost") return;
    if (board[r][c].revealed) return;
    const next: Board = board.map((row, rr) =>
      row.map((cell, cc) =>
        rr === r && cc === c ? { ...cell, flagged: !cell.flagged } : cell
      )
    );
    setBoard(next);
  };

  const flagCount = useMemo(() => countFlags(board), [board]);
  const minesLeft = Math.max(0, difficulty.mines - flagCount);

  const seconds = Math.min(999, Math.floor(elapsedMs / 1000));

  // Bigger cells on touch-sized viewports so they're reachable by a
  // thumb without repeated mis-taps.
  const isNarrow =
    typeof window !== "undefined" && window.innerWidth <= 480;
  const cellSize = isNarrow
    ? difficulty.cols >= 16
      ? 22
      : 30
    : difficulty.cols >= 16
    ? 20
    : 24;

  return (
    <div
      style={{
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        overflow: "auto",
        flex: 1,
      }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <label style={{ fontSize: 12 }}>
          Difficulty:&nbsp;
          <select
            value={difficulty.label}
            onChange={(e) =>
              reset(
                DIFFICULTIES.find((d) => d.label === e.target.value) ??
                  DIFFICULTIES[0]
              )
            }
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.label} value={d.label}>
                {d.label} ({d.rows}×{d.cols}, {d.mines})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "4px 8px",
          background: "#c0c0c0",
          border: "2px inset #fff",
          minWidth: 200,
        }}
      >
        <div
          style={{
            background: "#000",
            color: "#f00",
            fontFamily: "monospace",
            fontWeight: "bold",
            fontSize: 18,
            padding: "2px 6px",
            minWidth: 48,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label="Mines remaining"
        >
          {minesLeft.toString().padStart(3, "0")}
        </div>
        <button
          onClick={() => reset()}
          style={{
            fontSize: 22,
            width: 40,
            height: 40,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
          aria-label="New game"
        >
          {status === "won" ? (
            "🏴‍☠️"
          ) : status === "lost" ? (
            "💀"
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/icons/pirate-smiley.png"
              alt=""
              width={30}
              height={30}
              style={{ imageRendering: "pixelated" }}
            />
          )}
        </button>
        <div
          style={{
            background: "#000",
            color: "#f00",
            fontFamily: "monospace",
            fontWeight: "bold",
            fontSize: 18,
            padding: "2px 6px",
            minWidth: 48,
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
          aria-label="Seconds elapsed"
        >
          {seconds.toString().padStart(3, "0")}
        </div>
      </div>

      <div>
        <button
          onClick={() => setFlagMode((v) => !v)}
          aria-pressed={flagMode}
          style={{ fontSize: 12 }}
          title="Raise the Jolly Roger (useful on touch devices)"
        >
          {flagMode ? "🏴‍☠️ Flag mode ON" : "🏴‍☠️ Flag mode"}
        </button>
      </div>

      <div
        role="grid"
        aria-label="Minesweeper board"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${difficulty.cols}, ${cellSize}px)`,
          gap: 0,
          border: "2px inset #fff",
          background: "#808080",
          userSelect: "none",
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <CellButton
              key={`${r}-${c}`}
              cell={cell}
              size={cellSize}
              onReveal={() => handleReveal(r, c)}
              onFlag={() => handleFlag(r, c)}
              flagMode={flagMode}
              disabled={status === "won" || status === "lost"}
            />
          ))
        )}
      </div>

      {status === "won" && (
        <div style={{ fontWeight: "bold" }}>
          🏴‍☠️ Avast! You cleared the deck in {seconds}s.
        </div>
      )}
      {status === "lost" && (
        <div style={{ fontWeight: "bold", color: "#800000" }}>
          💀 Walked the plank. Try again?
        </div>
      )}
    </div>
  );
}

function CellButton({
  cell,
  size,
  onReveal,
  onFlag,
  flagMode,
  disabled,
}: {
  cell: Cell;
  size: number;
  onReveal: () => void;
  onFlag: () => void;
  flagMode: boolean;
  disabled: boolean;
}) {
  const bg = cell.revealed
    ? cell.mine
      ? "#ff8080"
      : "#bdbdbd"
    : "#c0c0c0";
  const border = cell.revealed ? "1px solid #808080" : "2px outset #fff";
  const content = cell.revealed
    ? cell.mine
      ? "💀"
      : cell.adjacent > 0
      ? String(cell.adjacent)
      : ""
    : cell.flagged
    ? "🏴‍☠️"
    : "";
  const numberColor =
    cell.revealed && !cell.mine && cell.adjacent > 0
      ? NUMBER_COLORS[cell.adjacent]
      : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (flagMode) {
      onFlag();
    } else {
      onReveal();
    }
    e.preventDefault();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    onFlag();
  };

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      disabled={disabled && !cell.revealed}
      style={{
        width: size,
        height: size,
        padding: 0,
        fontSize: Math.max(11, Math.floor(size * 0.55)),
        fontWeight: "bold",
        background: bg,
        border,
        color: numberColor,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {content}
    </button>
  );
}
