"use client";

import { memo } from "react";
import { assertNever } from "@/lib/assertNever";
import { Program, windowAtomFamily } from "@/state/window";
import { useSetAtom } from "jotai";
import { Iframe } from "./programs/Iframe";
import { Welcome } from "./programs/Welcome";
import { Run } from "./programs/Run";
import { Help } from "./programs/Help";
import { Explorer } from "./programs/Explorer";
import { Settings } from "./programs/Settings";
import { History } from "./programs/History";
import { Alert } from "./programs/Alert";
import { Blog } from "./programs/Blog";
import { Resume } from "./programs/Resume";
import { Shortcuts } from "./programs/Shortcuts";
import { Mail } from "./programs/Mail";
import { Minesweeper } from "./programs/Minesweeper";
import { Guestbook } from "./programs/Guestbook";
import { Recycle } from "./programs/Recycle";

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
