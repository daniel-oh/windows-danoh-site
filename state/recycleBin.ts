"use client";

import { atomWithStorage, createJSONStorage } from "jotai/utils";
import type { Program, WindowState } from "./window";

// What we snapshot from a window when it's closed so we can later
// restore it. Includes enough to recreate the window via createWindow.
export type RecycleBinEntry = {
  /** Stable id for the bin entry itself (not the original window id). */
  binId: string;
  title: string;
  program: Program;
  size: WindowState["size"];
  icon?: string;
  closedAt: number;
};

export const RECYCLE_BIN_LIMIT = 20;

// LocalStorage-backed so the bin survives a refresh. Retain up to
// RECYCLE_BIN_LIMIT entries, newest-first.
const binStorage = createJSONStorage<RecycleBinEntry[]>(() =>
  typeof window !== "undefined" ? window.localStorage : undefined!
);

// getOnInit matters here: the atom is written (window closed) before it
// is ever read (Recycle window opened). Without it, the first write of a
// session updates the in-memory default [] and overwrites localStorage,
// silently wiping every prior session's entries.
export const recycleBinAtom = atomWithStorage<RecycleBinEntry[]>(
  "danoh_recycle_bin",
  [],
  binStorage,
  { getOnInit: true }
);
