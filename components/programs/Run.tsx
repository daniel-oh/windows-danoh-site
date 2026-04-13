"use client";
import { useAtomValue, useSetAtom } from "jotai";
import { windowsListAtom } from "@/state/windowsList";
import { createWindow } from "../../lib/createWindow";
import { ProgramEntry, programsAtom } from "@/state/programs";
import { useEffect, useState } from "react";
import { getSettings } from "@/lib/getSettings";
import { settingsAtom } from "@/state/settings";
import wrappedFetch from "@/lib/wrappedFetch";

import { AccessCodePrompt } from "../AccessCodePrompt";

function hasSession() {
  return document.cookie.includes("lr_session=");
}

export function Run({ id }: { id: string }) {
  const windowsDispatch = useSetAtom(windowsListAtom);
  const programsDispatch = useSetAtom(programsAtom);
  const settings = useAtomValue(settingsAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    // Bypass access code if user has their own API key
    setAuthenticated(hasSession() || !!settings.apiKey);
  }, [settings.apiKey]);

  if (!authenticated) {
    return (
      <div style={{ padding: 4 }}>
        <AccessCodePrompt onSuccess={() => setAuthenticated(true)} />
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 8,
          }}
        >
          <button
            onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (isLoading) return;
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);
        const programDescription = formData.get("program-description");
        if (typeof programDescription === "string") {
          let name = programDescription;

          if (name.length > 20) {
            const nameResp = await wrappedFetch("/api/name", {
              method: "POST",
              body: JSON.stringify({
                desc: programDescription,
                settings: getSettings(),
              }),
            });

            name = (await nameResp.json()).name;
          }

          const program: ProgramEntry = {
            id: name,
            prompt: programDescription,
            name,
          };

          programsDispatch({ type: "ADD_PROGRAM", payload: program });

          createWindow({
            title: name,
            program: {
              type: "iframe",
              programID: program.id,
            },
            loading: true,
            size: {
              width: 700,
              height: 550,
            },
          });
          windowsDispatch({ type: "REMOVE", payload: id });
        }
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p>
          Describe any app you can imagine. The AI will generate a fully
          functional program for you in seconds.
        </p>
        <p style={{ fontSize: 11, color: "#555" }}>
          You can bring your own{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); createWindow({ title: "Settings", program: { type: "settings" } }); }} style={{ color: "#000080" }}>
            Anthropic API key
          </a>{" "}
          in Settings, or use an access code.
        </p>
      </div>
      <div className="field-row">
        <textarea
          aria-label="Program description"
          placeholder="Describe the program you want to run"
          id="program-description"
          rows={2}
          style={{
            width: "100%",
            resize: "vertical",
            maxHeight: "200px",
          }}
          name="program-description"
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="submit" disabled={isLoading}>
          Open
        </button>
        <button
          onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
