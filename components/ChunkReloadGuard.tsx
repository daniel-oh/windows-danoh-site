"use client";

import { useEffect } from "react";

// Every deploy changes the content-hashed chunk filenames. A tab that
// was open before the deploy asks the browser for chunks that no
// longer exist on the server, and whatever triggered the import
// (navigation, lazy component) throws a ChunkLoadError. Without this
// guard, that error propagates to global-error.tsx and the visitor
// sees the retry card — which works, but it's a jarring moment for
// what's really a harmless cache miss.
//
// Strategy: listen for both window-level error events and unhandled
// promise rejections, match ChunkLoadError-shaped messages, and force
// a single reload. sessionStorage gates against reload loops — if the
// reload itself fails to fix things within 10 seconds, we let the
// error bubble up so the visitor can see the fallback instead of
// being stuck in a refresh cycle.

const RELOAD_KEY = "danoh_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 10_000;

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i;

function looksLikeChunkError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string"
    ? err
    : (err as Error).message
      ? (err as Error).message
      : String(err);
  const name = (err as Error)?.name ?? "";
  return CHUNK_ERROR_PATTERN.test(msg) || name === "ChunkLoadError";
}

export function ChunkReloadGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const maybeReload = (err: unknown) => {
      if (!looksLikeChunkError(err)) return;
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
      if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // already tried
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => maybeReload(e.error || e.message);
    const onRejection = (e: PromiseRejectionEvent) => maybeReload(e.reason);

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
