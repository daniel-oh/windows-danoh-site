import { createWindow } from "@/lib/createWindow";
import type { WindowState } from "@/state/window";

// Single source of truth for the standard program windows — the ones
// the Start menu, the desktop icons, and the Welcome links all open.
// These definitions used to be copy-pasted across OS.tsx, Desktop.tsx,
// and Welcome.tsx, where the title / size / icon literals could drift.
//
// This module is a leaf: it imports only createWindow + a type, never a
// program component, so the components can import openProgram() from
// here without a circular dependency.
//
// Out of scope (context-specific, not standard menu/icon opens): the
// generated-app iframe opener (Run), File>New actions (WindowMenuBar),
// and the Recycle re-open path.

export const WELCOME_WIDTH = 700;
export const SETTINGS_WIDTH = 420;
export const SETTINGS_HEIGHT = 520;

export type ProgramKey =
  | "welcome"
  | "blog"
  | "resume"
  | "run"
  | "mail"
  | "guestbook"
  | "minesweeper"
  | "explorer"
  | "settings"
  | "shortcuts"
  | "recycle";

type ProgramDef = {
  title: string;
  program: WindowState["program"];
  size?: WindowState["size"];
  /** Window icon (taskbar / title bar). Distinct from the desktop-icon
   * image, which lives in Desktop.tsx. */
  icon?: string;
};

export const PROGRAMS: Record<ProgramKey, ProgramDef> = {
  welcome: {
    title: "Welcome to danoh.com",
    program: { type: "welcome" },
    size: { width: WELCOME_WIDTH, height: "auto" },
  },
  blog: {
    title: "Blog",
    program: { type: "blog" },
    size: { width: 700, height: 500 },
  },
  resume: {
    title: "Resume - Daniel Oh",
    program: { type: "resume" },
    size: { width: 700, height: 550 },
  },
  // No size → createWindow's MIN_WINDOW_SIZE default (a small dialog).
  run: { title: "Run", program: { type: "run" } },
  mail: {
    title: "New Message",
    program: { type: "mail" },
    // Tall enough that Send is visible without scrolling the form.
    size: { width: 460, height: 520 },
  },
  guestbook: {
    title: "Guestbook",
    program: { type: "guestbook" },
    size: { width: 440, height: 520 },
  },
  minesweeper: {
    title: "Minesweeper",
    program: { type: "minesweeper" },
    size: { width: 320, height: 440 },
    icon: "/icons/pirate-playing.png",
  },
  explorer: {
    title: "Explorer",
    program: { type: "explorer" },
    size: { width: 480, height: 400 },
  },
  settings: {
    title: "Settings",
    program: { type: "settings" },
    size: { width: SETTINGS_WIDTH, height: SETTINGS_HEIGHT },
  },
  shortcuts: {
    title: "Keyboard Shortcuts",
    program: { type: "shortcuts" },
    size: { width: 440, height: 380 },
  },
  recycle: {
    title: "Recycle Bin",
    program: { type: "recycle" },
    size: { width: 420, height: 420 },
    icon: "/icons/recycle-bin.png",
  },
};

/** Open one of the standard program windows. Returns the new window id. */
export function openProgram(key: ProgramKey): string {
  return createWindow({ ...PROGRAMS[key] });
}
