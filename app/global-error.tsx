"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Report to PostHog so we find out about client crashes without
  // depending on visitors flagging them. Wrapped in try/catch because
  // the boundary must never throw its own error. If PostHog wasn't
  // initialized (local dev, or the init itself is what crashed) the
  // capture call is a no-op.
  useEffect(() => {
    try {
      posthog.capture("client_error", {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      });
    } catch {
      // swallow — telemetry isn't allowed to break the fallback UI
    }
  }, [error]);

  return (
    <html>
      <body
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          background: "#008080",
        }}
      >
        <div
          style={{
            background: "#c0c0c0",
            border: "2px outset #fff",
            padding: 0,
            maxWidth: 400,
          }}
        >
          <div
            style={{
              background: "#000080",
              color: "#fff",
              padding: "4px 8px",
              fontWeight: "bold",
              fontSize: 14,
            }}
          >
            danoh.com - Error
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ marginBottom: 12 }}>
              danoh.com encountered an error and needs to restart.
            </p>
            <p style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>
              Try clearing your browser cache if this keeps happening.
            </p>
            <div style={{ textAlign: "right" }}>
              <button
                onClick={reset}
                style={{
                  padding: "4px 24px",
                  cursor: "pointer",
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
