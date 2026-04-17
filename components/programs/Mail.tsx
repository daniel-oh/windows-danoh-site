"use client";

import { useSetAtom } from "jotai";
import { useState } from "react";
import { windowsListAtom } from "@/state/windowsList";
import {
  CONTACT_EMAIL,
  CONTACT_GITHUB,
  CONTACT_LINKEDIN,
} from "@/content/contact";

export function Mail({ id }: { id: string }) {
  const windowsDispatch = useSetAtom(windowsListAtom);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = () => {
    if (!CONTACT_EMAIL) return;
    const href =
      `mailto:${CONTACT_EMAIL}` +
      `?subject=${encodeURIComponent(subject || "Hello from danoh.com")}` +
      `&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  if (!CONTACT_EMAIL) {
    return (
      <div
        style={{
          padding: 16,
          fontSize: 13,
          lineHeight: 1.55,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        <p style={{ margin: 0 }}>
          Email isn&apos;t set up for this inbox — but I&apos;d love to hear
          from you.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={CONTACT_LINKEDIN} target="_blank" rel="noopener noreferrer">
            <button>Message on LinkedIn</button>
          </a>
          <a href={CONTACT_GITHUB} target="_blank" rel="noopener noreferrer">
            <button>GitHub</button>
          </a>
          <button
            onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: 1,
        overflow: "auto",
      }}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <p style={{ fontSize: 12, color: "#555", margin: 0 }}>
        New Message — opens in your default mail client.
      </p>
      <div className="field-row-stacked">
        <label htmlFor="mail-to">To</label>
        <input id="mail-to" type="text" value={CONTACT_EMAIL} readOnly />
      </div>
      <div className="field-row-stacked">
        <label htmlFor="mail-subject">Subject</label>
        <input
          id="mail-subject"
          type="text"
          placeholder="Hello from danoh.com"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          autoFocus
        />
      </div>
      <div
        className="field-row-stacked"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <label htmlFor="mail-body">Message</label>
        <textarea
          id="mail-body"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ width: "100%", flex: 1, resize: "vertical", minHeight: 120 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="submit">Send</button>
        <button
          type="button"
          onClick={() => windowsDispatch({ type: "REMOVE", payload: id })}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
