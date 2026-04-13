"use client";

import { assertNever } from "@/lib/assertNever";
import { WindowState, windowAtomFamily } from "@/state/window";
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

export function WindowBody({ state }: { state: WindowState }) {
  const dispatch = useSetAtom(windowAtomFamily(state.id));

  if (state.error) {
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
          <p style={{ margin: 0, fontSize: 14 }}>{state.error}</p>
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

  switch (state.program.type) {
    case "welcome":
      return <Welcome id={state.id} />;
    case "run":
      return <Run id={state.id} />;
    case "iframe":
      return <Iframe id={state.id} />;
    case "help":
      return <Help id={state.id} />;
    case "explorer":
      return <Explorer id={state.id} />;
    case "settings":
      return <Settings id={state.id} />;
    case "history":
      return <History id={state.program.programID} />;
    case "alert":
      return <Alert id={state.id} />;
    case "blog":
      return <Blog id={state.id} />;
    default:
      assertNever(state.program);
  }
}
