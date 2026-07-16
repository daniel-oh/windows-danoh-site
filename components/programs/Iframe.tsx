"use client";
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from "jotai";
import { getIframeID, windowAtomFamily } from "@/state/window";
import { useEffect, useRef } from "react";
import { programAtomFamily, programsAtom } from "@/state/programs";
import assert from "assert";
import { registryAtom } from "@/state/registry";
import { getProgramRequestBody } from "@/lib/programRequest";
import { getSettings } from "@/lib/getSettings";
import { settingsAtom } from "@/state/settings";
import wrappedFetch from "@/lib/wrappedFetch";
import { alert } from "@/lib/alert";
import { useServerPrograms } from "@/lib/useServerPrograms";
import { registerCloseGuard } from "@/lib/windowCloseGuards";
import {
  isPendingFirstRun,
  resolvePendingFirstRun,
} from "@/lib/pendingFirstRun";

// Shell document for live generation. The parent fetches the program
// stream itself and forwards chunks here via postMessage; this script
// document.write()s them so the app still renders progressively. That
// indirection is the security boundary: the old approach pointed the
// iframe straight at /api/program with `allow-same-origin`, which let
// freshly generated (untrusted, prompt-injectable) code read the
// parent's localStorage — including a visitor's own Anthropic API key.
// With srcDoc + allow-scripts only, the generated code runs in an
// opaque origin from the very first byte, exactly like saved programs.
const STREAM_BOOTSTRAP = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var started = false;
  window.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.op === "danoh-stream-chunk") {
      if (!started) { started = true; document.open(); }
      document.write(d.html);
    } else if (d.op === "danoh-stream-end") {
      if (started) document.close();
    }
  });
  window.parent.postMessage({ operation: "danoh-stream-ready" }, "*");
})();
</${"script"}></body></html>`;

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

  // Stringified at render so the streaming effect below captures one
  // stable snapshot per generation, same as the old URL string did.
  const requestBody = JSON.stringify(getProgramRequestBody(program, registry));

  useEffect(() => {
    async function fetchIcon() {
      if (startedRef.current) {
        return;
      }
      startedRef.current = true;
      // The icon is cosmetic — a failed fetch must reset the flag so a
      // later render can retry, and a network throw must not surface as
      // an unhandled rejection.
      try {
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
      } catch {
        /* cosmetic — retry on a later render */
      } finally {
        startedRef.current = false;
      }
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
          (event.source as Window).postMessage(
            {
              operation: "result",
              id,
              value: registry[namespaceKey(key)],
            },
            // "*" because srcDoc-sandboxed iframes have an opaque origin —
            // the default (sender-origin) targetOrigin never matches it and
            // the reply is silently dropped. Source is already verified to
            // be exactly our iframe's contentWindow above.
            "*"
          );
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
          (event.source as Window).postMessage(
            { operation: "result", id, value: visible },
            "*"
          );
          break;
        }
        case "chat": {
          // No client-side key gate: the server accepts an own key OR a
          // signed-in session, and the client can't see the latter. Let
          // the server decide and translate its 401 into the friendly
          // string generated apps expect.
          const currentSettings = getSettings();
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
          // Generated apps bake the result string into their UI — a raw
          // {"error":"Unauthorized"} object would render as gibberish.
          const chatValue =
            result.status === 401
              ? "Chat API is not available. Add your own API key in Settings to enable this feature."
              : await result.json();
          (event.source as Window).postMessage(
            { operation: "result", value: chatValue, id },
            "*"
          );
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
        case "danoh-stream-ready": {
          // Generation handshake — consumed by the streaming effect below.
          break;
        }

        default:
          console.error("Unsupported operation");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [dispatch, ref, programID]);

  // A program whose first generation never succeeded (stream error, or
  // the visitor closed mid-stream) must not survive as a dead desktop
  // icon. A close guard rather than an unmount cleanup: guards only run
  // on real closes, so StrictMode's dev double-mount can't delete a
  // program that's still generating.
  useEffect(() => {
    return registerCloseGuard(id, () => {
      if (isPendingFirstRun(programID)) {
        resolvePendingFirstRun(programID);
        dispatchPrograms({ type: "REMOVE_PROGRAM", payload: programID });
      }
      return true;
    });
  }, [id, programID, dispatchPrograms]);

  // Key changes when code updates, forcing iframe to remount with new content
  const codeVersion = program?.currentVersion || 0;
  const hasCode = !!program?.code;

  // Live generation: fetch the program stream in the parent and forward
  // chunks into the sandboxed bootstrap iframe (see STREAM_BOOTSTRAP for
  // why). The parent accumulates the raw stream and persists that — a
  // cleaner artifact than the old DOM snapshot, which baked in whatever
  // mutations the app's init code had already made.
  useEffect(() => {
    if (hasCode) return;
    const iframe = ref.current;
    if (!iframe) return;

    const controller = new AbortController();
    let html = "";
    let buffered: string[] = [];
    let ready = false;
    let ended = false;
    let revealed = false;

    const post = (msg: object) =>
      iframe.contentWindow?.postMessage(msg, "*");
    const sendChunk = (chunk: string) => {
      post({ op: "danoh-stream-chunk", html: chunk });
      if (!revealed) {
        revealed = true;
        // Drop the loading overlay at first byte so the visitor watches
        // the app stream in — that's the whole show.
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    const onReady = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      if (e.data?.operation !== "danoh-stream-ready") return;
      ready = true;
      for (const c of buffered) sendChunk(c);
      buffered = [];
      if (ended) post({ op: "danoh-stream-end" });
    };
    window.addEventListener("message", onReady);

    (async () => {
      try {
        const res = await fetch("/api/program", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: requestBody,
          signal: controller.signal,
        });
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            html += chunk;
            if (ready) sendChunk(chunk);
            else buffered.push(chunk);
          }
          const tail = decoder.decode();
          if (tail) {
            html += tail;
            if (ready) sendChunk(tail);
            else buffered.push(tail);
          }
        }
        ended = true;
        if (ready) post({ op: "danoh-stream-end" });
        dispatch({ type: "SET_LOADING", payload: false });
        // Persist only real generations. Error pages (rate limit,
        // upstream failure) carry the danoh-error meta marker and a
        // non-2xx status; freezing one as the program's code would
        // make the failure permanent.
        if (res.ok && html && !html.includes('name="danoh-error"')) {
          resolvePendingFirstRun(programID);
          dispatchPrograms({
            type: "UPDATE_PROGRAM",
            payload: { id: programID, code: html },
          });
          saveProgram({
            id: programID,
            name: state.title,
            prompt: program?.prompt ?? "",
            code: html,
          });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        dispatch({ type: "SET_LOADING", payload: false });
        // A fetch error is a network/server failure, not a billing
        // state — don't diagnose it as "out of tokens".
        alert({
          message:
            "This program couldn't load. Check your connection, then use File > Reload to try again.",
          icon: "x",
        });
      }
    })();

    return () => {
      controller.abort();
      window.removeEventListener("message", onReady);
    };
    // requestBody/state.title/program.prompt are intentionally captured
    // per generation: a registry write mid-stream must not abort and
    // restart a paid generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCode, programID, codeVersion]);

  return (
    <iframe
      key={codeVersion}
      ref={ref}
      id={getIframeID(id)}
      title={state.title}
      // allow-scripts WITHOUT allow-same-origin, in both modes: the
      // generated code is untrusted (built from an arbitrary visitor
      // prompt) and must never share the parent's origin/storage.
      sandbox="allow-scripts"
      srcDoc={program?.code || STREAM_BOOTSTRAP}
      style={{ width: "100%", height: "100%", flex: "1 1 0", minHeight: 0, border: "none" }}
    />
  );
}
