"use client";
import { useAtomValue, useSetAtom } from "jotai";
import { windowsListAtom } from "@/state/windowsList";
import { windowAtomFamily } from "@/state/window";
import { createWindow } from "../../lib/createWindow";
import { ProgramEntry, programsAtom } from "@/state/programs";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSettings } from "@/lib/getSettings";
import { settingsAtom } from "@/state/settings";
import wrappedFetch from "@/lib/wrappedFetch";

import { AccessCodePrompt } from "../AccessCodePrompt";
import { ByokPrompt } from "../ByokPrompt";
import { openDemoProgram } from "@/lib/demoPrograms";

function hasSession() {
  return document.cookie.includes("lr_session=");
}

const PROMPT_EXAMPLES = [
  "a pomodoro timer with clicky sounds",
  "a notes app that saves files",
  "a trivia game that generates questions with AI",
  "a pixel-art paint program",
];

export function Run({ id }: { id: string }) {
  const windowsDispatch = useSetAtom(windowsListAtom);
  const programsDispatch = useSetAtom(programsAtom);
  const settings = useAtomValue(settingsAtom);
  const windowState = useAtomValue(windowAtomFamily(id));
  const initialPrompt =
    windowState.program.type === "run"
      ? windowState.program.initialPrompt
      : undefined;
  const [isLoading, setIsLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const autoSubmittedRef = useRef(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    // Bypass access code if user has their own API key
    setAuthenticated(hasSession() || !!settings.apiKey);
  }, [settings.apiKey]);

  const submitPrompt = useCallback(
    async (desc: string) => {
      if (isLoading) return;
      const trimmed = desc.trim();
      if (!trimmed) return;
      setIsLoading(true);
      // The name is a nicety — if /api/name fails (rate limit, network),
      // fall back to a truncated prompt instead of bricking the dialog
      // or creating a program literally named "undefined".
      let name = trimmed.length > 24 ? `${trimmed.slice(0, 24).trimEnd()}…` : trimmed;
      if (trimmed.length > 20) {
        try {
          const nameResp = await wrappedFetch("/api/name", {
            method: "POST",
            body: JSON.stringify({
              desc: trimmed,
              settings: getSettings(),
            }),
          });
          if (nameResp.ok) {
            const generated = (await nameResp.json()).name;
            if (typeof generated === "string" && generated.trim()) {
              name = generated;
            }
          }
        } catch {
          /* keep the fallback name */
        } finally {
          setIsLoading(false);
        }
      }
      const program: ProgramEntry = {
        id: name,
        prompt: trimmed,
        name,
      };
      programsDispatch({ type: "ADD_PROGRAM", payload: program });
      createWindow({
        title: name,
        program: { type: "iframe", programID: program.id },
        loading: true,
        size: { width: 700, height: 550 },
      });
      windowsDispatch({ type: "REMOVE", payload: id });
    },
    [id, isLoading, programsDispatch, windowsDispatch]
  );

  // Auto-fire when opened via a shareable URL (?run=...)
  useEffect(() => {
    if (!authenticated) return;
    if (!initialPrompt) return;
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    submitPrompt(initialPrompt);
  }, [authenticated, initialPrompt, submitPrompt]);

  if (!authenticated) {
    return (
      <div
        style={{
          padding: 4,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* A ?run= deep link arrives gated — show the visitor their
         * prompt survived the trip instead of leaving them to wonder. */}
        {initialPrompt && (
          <p
            style={{
              fontSize: 11,
              background: "#ffffe1",
              border: "1px solid #808080",
              padding: "4px 6px",
              margin: 0,
            }}
          >
            Queued:{" "}
            <strong>
              &ldquo;
              {initialPrompt.length > 90
                ? `${initialPrompt.slice(0, 90)}…`
                : initialPrompt}
              &rdquo;
            </strong>{" "}
            · runs as soon as you&apos;re in.
          </p>
        )}
        <fieldset>
          <legend>Use your own Anthropic key</legend>
          <ByokPrompt onSuccess={() => setAuthenticated(true)} />
        </fieldset>
        <fieldset>
          <legend>Or enter an access code</legend>
          <AccessCodePrompt
            onSuccess={() => setAuthenticated(true)}
            byokHint={false}
          />
        </fieldset>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
            Just browsing?{" "}
            <a
              href="#"
              style={{ color: "#000080" }}
              onClick={(e) => {
                e.preventDefault();
                void openDemoProgram();
              }}
            >
              Watch one I made earlier
            </a>
            .
          </p>
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
        const formData = new FormData(e.currentTarget);
        const programDescription = formData.get("program-description");
        if (typeof programDescription === "string") {
          await submitPrompt(programDescription);
        }
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <p>
          Describe any app you can imagine. The AI will generate a fully
          functional program for you in seconds.
        </p>
      </div>
      <div className="field-row">
        <textarea
          ref={promptRef}
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
          defaultValue={initialPrompt}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </div>
      {/* Click-to-fill starters. Two of them advertise the OS APIs
       * (files, AI chat) that nothing else surfaces at the moment of
       * prompting — the system prompt injects those capabilities, but
       * visitors can't use what they don't know exists. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "#444" }}>Try:</span>
        {PROMPT_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            style={{ fontSize: 11, minWidth: 0, padding: "2px 8px" }}
            onClick={() => {
              const ta = promptRef.current;
              if (!ta) return;
              ta.value = example;
              ta.focus();
            }}
          >
            {example}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
        Apps can save files, remember settings, and call AI. Just ask.
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Whose dime is this generation on? Always answerable. */}
        <p style={{ fontSize: 11, color: "#444", margin: 0 }}>
          {settings.apiKey ? (
            <>
              Using your Anthropic key (…{settings.apiKey.slice(-4)}) ·{" "}
              <a
                href="#"
                style={{ color: "#000080" }}
                onClick={(e) => {
                  e.preventDefault();
                  createWindow({
                    title: "Settings",
                    program: { type: "settings" },
                  });
                }}
              >
                Manage
              </a>
            </>
          ) : (
            <>Using an access code session.</>
          )}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Opening…" : "Open"}
          </button>
          <button
            type="button"
            onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
