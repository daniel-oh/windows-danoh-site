"use client";

import { useState } from "react";

export function AccessCodePrompt({
  onSuccess,
  message = "Enter access code:",
}: {
  onSuccess: () => void;
  message?: string;
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
          autoFocus
          disabled={loading}
          style={{ flex: 1 }}
          placeholder="Access code"
        />
        <button type="submit" disabled={loading || !code}>
          {loading ? "..." : "OK"}
        </button>
      </div>
      {error && (
        <div style={{ color: "red", fontSize: 11 }}>{error}</div>
      )}
    </form>
  );
}
