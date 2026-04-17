"use client";
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from "jotai";
import { getIframeID, windowAtomFamily } from "@/state/window";
import { useEffect, useRef } from "react";
import { programAtomFamily, programsAtom } from "@/state/programs";
import assert from "assert";
import { registryAtom } from "@/state/registry";
import { getURLForProgram } from "@/lib/getURLForProgram";
import { getSettings } from "@/lib/getSettings";
import { settingsAtom } from "@/state/settings";
import wrappedFetch from "@/lib/wrappedFetch";
import { showUpsell } from "@/lib/showUpsell";
import { useServerPrograms } from "@/lib/useServerPrograms";

export function Iframe({ id }: { id: string }) {
  const window = useAtomValue(windowAtomFamily(id));
  assert(window.program.type === "iframe", "Window is not an iframe");
  const program = useAtomValue(programAtomFamily(window.program.programID));
  // Return null if the program is not found
  if (!program) {
    return null;
  }
  return <IframeInner id={id} />;
}

function IframeInner({ id }: { id: string }) {
  const [state, dispatch] = useAtom(windowAtomFamily(id));
  const ref = useRef<HTMLIFrameElement>(null);
  const dispatchPrograms = useSetAtom(programsAtom);
  const startedRef = useRef(false);
  const registry = useAtomValue(registryAtom);
  const { model } = useAtomValue(settingsAtom);
  const { saveProgram } = useServerPrograms();

  assert(state.program.type === "iframe", "Program is not an iframe");

  const program = useAtomValue(programAtomFamily(state.program.programID));

  const { icon } = state;

  const programID = state.program.programID;

  assert(program, "Program not found");

  const url = getURLForProgram(program, registry);

  useEffect(() => {
    async function fetchIcon() {
      if (startedRef.current) {
        return;
      }
      startedRef.current = true;
      const res = await wrappedFetch(`/api/icon?name=${state.title}`, {
        method: "POST",
        body: JSON.stringify({ name: state.title, settings: getSettings() }),
      });

      if (!res.ok) {
        return;
      }
      const dataUri = await res.text();
      dispatch({ type: "SET_ICON", payload: dataUri });
      dispatchPrograms({
        type: "UPDATE_PROGRAM",
        payload: {
          id: programID,
          name: state.title,
          icon: dataUri,
        },
      });
      saveProgram({ id: programID, name: state.title, prompt: program?.prompt ?? "", icon: dataUri });
      startedRef.current = false;
    }
    if (!icon && model === "best") {
      fetchIcon();
    }
  }, [state.title, dispatch, dispatchPrograms, icon, programID, model, saveProgram, program?.prompt]);

  // Adding message event listener to the iframe to handle registry operations
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Check if the message is from our iframe
      if (event.source !== ref.current?.contentWindow) {
        return;
      }
      // Validate origin for non-srcDoc iframes (srcDoc has origin "null")
      if (event.origin !== "null" && event.origin !== window.location.origin) {
        return;
      }

      const { operation, key, value, id, returnJson } = event.data;

      // Validate operation is a known string
      if (typeof operation !== "string") return;

      // Validate key shape (allowlist): alphanumeric + `_` + `-`.
      // Colon is reserved as the per-program namespace separator.
      if (key !== undefined && (typeof key !== "string" || !/^[a-zA-Z0-9_-]+$/.test(key))) {
        return;
      }

      // Per-program namespacing: keys prefixed `public_` stay shared across
      // programs (legacy convention documented in iframe/api.ts). Every other
      // key is rewritten to `${programID}:${key}` so Program A cannot read or
      // overwrite Program B's registry entries.
      const PROGRAM_PREFIX = `${programID}:`;
      const namespaceKey = (k: string) =>
        k.startsWith("public_") ? k : `${PROGRAM_PREFIX}${k}`;
      const denamespaceKey = (k: string): string | null => {
        if (k.startsWith("public_")) return k;
        if (k.startsWith(PROGRAM_PREFIX)) return k.slice(PROGRAM_PREFIX.length);
        return null;
      };

      const store = getDefaultStore();
      const registry = await store.get(registryAtom);

      switch (operation) {
        case "get": {
          event.source!.postMessage({
            operation: "result",
            id,
            value: registry[namespaceKey(key)],
          });
          break;
        }
        case "set": {
          store.set(registryAtom, {
            ...registry,
            [namespaceKey(key)]: value,
          });
          break;
        }
        case "delete": {
          store.set(registryAtom, {
            ...registry,
            [namespaceKey(key)]: undefined,
          });
          break;
        }
        case "listKeys": {
          const visible = Object.keys(registry)
            .map(denamespaceKey)
            .filter((k): k is string => k !== null);
          event.source!.postMessage({
            operation: "result",
            id,
            value: visible,
          });
          break;
        }
        case "chat": {
          // Only allow iframe chat if user has their own API key
          const currentSettings = getSettings();
          if (!currentSettings.apiKey) {
            event.source!.postMessage({
              operation: "result",
              value: "Chat API is not available. Add your own API key in Settings to enable this feature.",
              id,
            });
            break;
          }
          // Sanitize messages from iframe — only allow user/assistant roles, limit count
          const iframeMessages = Array.isArray(value)
            ? value
                .filter((m: any) => typeof m === "object" && (m.role === "user" || m.role === "assistant"))
                .slice(-10)
                .map((m: any) => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 5000) : "" }))
            : [];
          const result = await wrappedFetch(`/api/chat`, {
            method: "POST",
            body: JSON.stringify({
              messages: iframeMessages,
              returnJson,
              settings: currentSettings,
            }),
          });
          event.source!.postMessage({
            operation: "result",
            value: await result.json(),
            id,
          });
          break;
        }
        case "registerOnSave": {
          dispatch({
            type: "UPDATE_PROGRAM",
            payload: { type: "iframe", canSave: true },
          });
          break;
        }
        case "registerOnOpen": {
          dispatch({
            type: "UPDATE_PROGRAM",
            payload: { type: "iframe", canOpen: true },
          });
          break;
        }
        case "saveComplete": {
          // Handled in Window.tsx
          break;
        }

        default:
          console.error("Unsupported operation");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [dispatch, ref]);

  // Key changes when code updates, forcing iframe to remount with new content
  const codeVersion = program?.currentVersion || 0;

  return (
    <iframe
      key={codeVersion}
      ref={ref}
      id={getIframeID(id)}
      sandbox={program?.code ? "allow-scripts" : "allow-scripts allow-same-origin"}
      src={!program?.code ? url : undefined}
      srcDoc={program?.code || undefined}
      style={{ width: "100%", height: "100%", flex: "1 1 0", minHeight: 0, border: "none" }}
      onError={() => {
        showUpsell();
      }}
      onLoad={() => {
        assert(state.program.type === "iframe", "Program is not an iframe");

        if (program?.code) {
          return;
        }

        dispatch({ type: "SET_LOADING", payload: false });
        if (ref.current) {
          const outerHTML =
            ref.current.contentDocument?.documentElement.outerHTML;
          assert(outerHTML, "Outer HTML of iframe content is undefined");
          assert(state.program.type === "iframe", "Program is not an iframe");
          dispatchPrograms({
            type: "UPDATE_PROGRAM",
            payload: {
              id: programID,
              code: outerHTML,
            },
          });
          saveProgram({ id: programID, name: state.title, prompt: program?.prompt ?? "", code: outerHTML });
        }
      }}
    />
  );
}
