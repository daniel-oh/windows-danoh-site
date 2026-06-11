"use client";

import { useState } from "react";
import { isCoarsePointer } from "@/lib/isCoarsePointer";

export function AccessCodePrompt({
  onSuccess,
  message = "Enter access code:",
  byokHint = true,
}: {
  onSuccess: () => void;
  message?: string;
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
        setError("Incorrect code. Please try again.");
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
          value={code}
          onChange={(e) => setCode(e.target.value)}
          // Skip on touch: auto-focusing pops the soft keyboard and
          // shows a focus ring the moment the gate appears.
          autoFocus={!isCoarsePointer()}
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
        <div role="alert" style={{ color: "red", fontSize: 11 }}>
          {error}
        </div>
      )}
      <div style={{ fontSize: 11, color: "#444" }}>
        No code? Send me a quick{" "}
        <a
          href="https://www.linkedin.com/in/daniel-oh/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#000080" }}
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
