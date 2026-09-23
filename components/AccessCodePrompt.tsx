"use client";

import { useState } from "react";
import { isCoarsePointer } from "@/lib/isCoarsePointer";

export function AccessCodePrompt({
  onSuccess,
  message = "Enter access code:",
  byokHint = true,
  autoFocus = true,
}: {
  onSuccess: () => void;
  message?: string;
  /** False when the gate opens in a window that is not the focused one, so
   * it cannot take the keyboard from whatever the visitor is reading. */
  autoFocus?: boolean;
  /** The Run gate shows its own inline key path right above this
   * prompt — suppress the redundant "bring your own key" clause there. */
  byokHint?: boolean;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        // The server says which: locked out, used up, expired. Each needs
        // a different next step, and "Incorrect code" for all of them sent
        // people retyping a code that was fine.
        const body = await res.json().catch(() => null);
        const said = typeof body?.error === "string" ? body.error : "";
        setError(
          res.status === 403 && /^Invalid code$/i.test(said)
            ? "Incorrect code. Please try again."
            : said && res.status < 500
              ? said
              : "Something went wrong on our side. Try again in a moment."
        );
      }
    } catch {
      setError("Couldn't connect. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ fontSize: 12, color: "#333" }}>{message}</div>
      <div style={{ display: "flex", gap: 5 }}>
        <input
          type="password"
          aria-label="Access code"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "access-code-error" : undefined}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          // Skip on touch: auto-focusing pops the soft keyboard and
          // shows a focus ring the moment the gate appears.
          autoFocus={autoFocus && !isCoarsePointer()}
          disabled={loading}
          style={{ flex: 1 }}
          placeholder="Access code"
          /* Not a credential — stops password managers offering to
           * save "a password for danoh.com" over a shared invite code. */
          autoComplete="one-time-code"
        />
        <button type="submit" disabled={loading || !code}>
          {loading ? "..." : "OK"}
        </button>
      </div>
      {error && (
        <div
          id="access-code-error"
          role="alert"
          style={{ color: "red", fontSize: 11 }}
        >
          {error}
        </div>
      )}
      <div style={{ fontSize: 11, color: "#444" }}>
        No code? Send me a quick{" "}
        <a
          href="https://www.linkedin.com/in/daniel-oh/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#000080", textDecoration: "underline" }}
        >
          message on LinkedIn
        </a>{" "}
        and I&apos;ll get you one{byokHint ? (
          <>, or bring your own Anthropic API key in Settings.</>
        ) : (
          "."
        )}
      </div>
    </form>
  );
}
