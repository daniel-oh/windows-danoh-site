"use client";

import { useCallback, useEffect, useState } from "react";
import { getVisitorId } from "@/lib/visitorId";

type Entry = {
  id: number;
  name: string | null;
  message: string;
  createdAt: string;
};

const MAX_NAME = 40;
const MAX_MESSAGE = 280;

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Guestbook() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/guestbook");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as { entries?: Entry[] };
      setEntries(data.entries ?? []);
      setError(null);
    } catch {
      setError("Couldn't load the wall. Try again in a sec.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const m = message.trim();
    if (!m) {
      setFeedback("Add a message first.");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          message: m,
          visitorId: getVisitorId(),
        }),
      });
      const data = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        setFeedback(data.error || "Something went wrong.");
      } else {
        setName("");
        setMessage("");
        if (data.status === "approved") {
          setFeedback("Posted! Thanks for signing in.");
          load();
        } else {
          setFeedback("Thanks — your message has been received.");
        }
      }
    } catch {
      setFeedback("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #808080",
          paddingBottom: 6,
        }}
      >
        <span style={{ fontSize: 18 }}>📖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "bold" }}>Guestbook</div>
          <div style={{ fontSize: 11, color: "#555" }}>
            Leave a note. No account needed. Messages pass through an AI
            filter before appearing.
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <div className="field-row-stacked">
          <label htmlFor="gb-name">Name (optional)</label>
          <input
            id="gb-name"
            type="text"
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="Anonymous"
          />
        </div>
        <div className="field-row-stacked">
          <label htmlFor="gb-message">Message</label>
          <textarea
            id="gb-message"
            rows={3}
            value={message}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="hi daniel :)"
            style={{ width: "100%", resize: "vertical" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit(e as unknown as React.FormEvent);
              }
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11,
            color: "#555",
          }}
        >
          <span>{message.length}/{MAX_MESSAGE}</span>
          <div>
            {feedback && <span style={{ marginRight: 8 }}>{feedback}</span>}
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Sign the guestbook"}
            </button>
          </div>
        </div>
      </form>

      <div
        style={{
          borderTop: "1px solid #808080",
          paddingTop: 8,
          overflow: "auto",
          flex: 1,
          minHeight: 80,
        }}
        aria-live="polite"
      >
        {loading && <div style={{ fontSize: 12, color: "#555" }}>Loading…</div>}
        {!loading && error && (
          <div style={{ fontSize: 12, color: "#800000" }}>{error}</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div style={{ fontSize: 12, color: "#555" }}>
            Be the first to sign.
          </div>
        )}
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map((e) => (
            <li
              key={e.id}
              style={{
                padding: "8px 2px",
                borderBottom: "1px dashed #aaa",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "baseline",
                  marginBottom: 2,
                }}
              >
                <span style={{ fontWeight: "bold" }}>
                  {e.name || "Anonymous"}
                </span>
                <span style={{ fontSize: 11, color: "#555" }}>
                  {relTime(e.createdAt)}
                </span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {e.message}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
