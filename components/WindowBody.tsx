"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import { assertNever } from "@/lib/assertNever";
import { Program, windowAtomFamily } from "@/state/window";
import { useSetAtom } from "jotai";

// Eager: instant-critical programs that must paint the moment they
// open, so a chunk fetch can't delay them.
//   - Alert  — modal confirmations (logout, close-guards) must appear now.
//   - Iframe — hosts generated apps; lazy-loading it would stall the
//              streaming generation flow on first open.
//   - Welcome — auto-opens for first-time visitors; keep the marquee snappy.
import { Iframe } from "./programs/Iframe";
import { Alert } from "./programs/Alert";
import { Welcome } from "./programs/Welcome";

// Everything else loads on first open. None of these render at boot
// (the desktop opens with no window), and the window-open animation
// covers the brief chunk fetch — so the program tree (and notably
// react-markdown via Help and the compiled MDX bodies via Blog) no
// longer ships in the initial bundle. A null loading state is invisible
// behind the already-painted window chrome.
// Direct dynamic() calls (not a generic wrapper) so each component's
// own prop type is inferred. A null loading state is invisible behind
// the already-painted window chrome.
const loading = () => null;
const Run = dynamic(() => import("./programs/Run").then((m) => m.Run), { loading });
const Help = dynamic(() => import("./programs/Help").then((m) => m.Help), { loading });
const Explorer = dynamic(
  () => import("./programs/Explorer").then((m) => m.Explorer),
  { loading }
);
const Settings = dynamic(
  () => import("./programs/Settings").then((m) => m.Settings),
  { loading }
);
const History = dynamic(
  () => import("./programs/History").then((m) => m.History),
  { loading }
);
const Blog = dynamic(() => import("./programs/Blog").then((m) => m.Blog), {
  loading,
});
const Resume = dynamic(() => import("./programs/Resume").then((m) => m.Resume), {
  loading,
});
const Shortcuts = dynamic(
  () => import("./programs/Shortcuts").then((m) => m.Shortcuts),
  { loading }
);
const Mail = dynamic(() => import("./programs/Mail").then((m) => m.Mail), {
  loading,
});
const Minesweeper = dynamic(
  () => import("./programs/Minesweeper").then((m) => m.Minesweeper),
  { loading }
);
const Guestbook = dynamic(
  () => import("./programs/Guestbook").then((m) => m.Guestbook),
  { loading }
);
const Recycle = dynamic(
  () => import("./programs/Recycle").then((m) => m.Recycle),
  { loading }
);

// Memoised so window-drag pos updates don't re-render the program
// tree. Props are sliced primitives — React.memo's shallow compare
// can skip renders cleanly when only pos or size changed upstream.
export const WindowBody = memo(function WindowBody({
  id,
  program,
  error,
}: {
  id: string;
  program: Program;
  error: string | undefined;
}) {
  const dispatch = useSetAtom(windowAtomFamily(id));

  if (error) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <img
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANklEQVR42mP4z8BQDwQMDAz/GUgETKQqHjVg1IBRA4YkDJiINQCbYUSnA2KDieh0QGwwEZ0OACGFdBFjCYDEAAAAAElFTkSuQmCC"
            alt="Error"
            width={32}
            height={32}
            style={{ imageRendering: "pixelated" }}
          />
          <p style={{ margin: 0, fontSize: 14 }}>{error}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            style={{ minWidth: 75 }}
            onClick={() => dispatch({ type: "SET_ERROR", payload: undefined })}
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  switch (program.type) {
    case "welcome":
      return <Welcome id={id} />;
    case "run":
      return <Run id={id} />;
    case "iframe":
      return <Iframe id={id} />;
    case "help":
      return <Help id={id} />;
    case "explorer":
      return <Explorer id={id} />;
    case "settings":
      return <Settings id={id} />;
    case "history":
      return <History id={program.programID} />;
    case "alert":
      return <Alert id={id} />;
    case "blog":
      return <Blog id={id} />;
    case "resume":
      return <Resume />;
    case "shortcuts":
      return <Shortcuts />;
    case "mail":
      return <Mail id={id} />;
    case "minesweeper":
      return <Minesweeper />;
    case "guestbook":
      return <Guestbook />;
    case "recycle":
      return <Recycle />;
    default:
      assertNever(program);
  }
});
