"use client";

import { useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { windowsListAtom } from "@/state/windowsList";
import {
  CONTACT_EMAIL,
  CONTACT_GITHUB,
  CONTACT_LINKEDIN,
} from "@/content/contact";
import { getVisitorId } from "@/lib/visitorId";

type Status = "idle" | "sending" | "sent" | "error";

// Common domain typos → canonical. A full levenshtein is overkill for
// 20 domains that account for 95% of consumer email; this static map
// catches the typo cases that matter ("gmial.com", "hotnail.com") and
// no-ops for everything else. Gentle nudge, not a block.
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "iclould.com": "icloud.com",
  "icluod.com": "icloud.com",
  "icloud.co": "icloud.com",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function suggestEmailFix(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  const fix = DOMAIN_TYPOS[domain];
  return fix ? `${local}@${fix}` : null;
}

export function Mail({ id }: { id: string }) {
  const windowsDispatch = useSetAtom(windowsListAtom);

  const [name, setName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [replyToTouched, setReplyToTouched] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const mountedAtRef = useRef(Date.now());

  const emailValid = replyTo === "" || EMAIL_RE.test(replyTo.trim());
  const emailSuggestion = suggestEmailFix(replyTo.trim());
  const hasDraft = (name + replyTo + subject + body).trim().length > 10;

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  const close = () => {
    if (status !== "sent" && hasDraft) {
      const ok = window.confirm(
        "You have an unsent message. Close anyway?"
      );
      if (!ok) return;
    }
    windowsDispatch({ type: "REMOVE", payload: id });
  };

  const send = async () => {
    if (!CONTACT_EMAIL) return;
    if (!body.trim()) {
      setErrorMsg("Add a message before sending.");
      setStatus("error");
      return;
    }
    if (replyTo.trim() && !EMAIL_RE.test(replyTo.trim())) {
      setErrorMsg("That reply-to email looks off. Fix it or clear it.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          replyTo: replyTo.trim() || undefined,
          subject: subject.trim() || undefined,
          message: body.trim(),
          visitorId: getVisitorId(),
          website, // honeypot value (should be empty)
          elapsedMs: Date.now() - mountedAtRef.current,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
      };
      if (!res.ok || data.status !== "sent") {
        setErrorMsg(data.error || "Couldn't send. Try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorMsg("Network error. Try again.");
      setStatus("error");
    }
  };

  const openInMailClient = () => {
    if (!CONTACT_EMAIL) return;
    const href =
      `mailto:${CONTACT_EMAIL}` +
      `?subject=${encodeURIComponent(subject || "Hello from danoh.com")}` +
      `&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  const copyEmail = async () => {
    if (!CONTACT_EMAIL) return;
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
    } catch {
      const el = document.createElement("textarea");
      el.value = CONTACT_EMAIL;
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {
        /* give up */
      }
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // No email address configured — push visitors to other channels
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
          Email isn&apos;t set up for this inbox, but I&apos;d love to hear
          from you.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={CONTACT_LINKEDIN} target="_blank" rel="noopener noreferrer">
            <button>Message on LinkedIn</button>
          </a>
          <a href={CONTACT_GITHUB} target="_blank" rel="noopener noreferrer">
            <button>GitHub</button>
          </a>
          <button onClick={close}>Close</button>
        </div>
      </div>
    );
  }

  // Delivered — confirmation state
  if (status === "sent") {
    return (
      <div
        style={{
          padding: 20,
          fontSize: 13,
          lineHeight: 1.6,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          flex: 1,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 32, lineHeight: 1 }}>📬</div>
        <div>
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>
            Message sent.
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            {replyTo
              ? `I'll reply to ${replyTo} when I see this.`
              : "Thanks for writing in. I'll read it soon."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              setName("");
              setReplyTo("");
              setSubject("");
              setBody("");
              setStatus("idle");
            }}
          >
            Send another
          </button>
          <button onClick={close}>Close</button>
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
        void send();
      }}
    >
      <p style={{ fontSize: 12, color: "#555", margin: 0 }}>
        Sends straight to my inbox. No mail client needed.
      </p>

      <div className="field-row-stacked">
        <label htmlFor="mail-name">Your name (optional)</label>
        <input
          id="mail-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="name"
        />
      </div>
      <div className="field-row-stacked">
        <label htmlFor="mail-reply">Reply-to email (optional)</label>
        <input
          id="mail-reply"
          type="email"
          placeholder="you@example.com"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          onBlur={() => setReplyToTouched(true)}
          maxLength={120}
          autoComplete="email"
          inputMode="email"
          aria-invalid={replyToTouched && !emailValid ? "true" : undefined}
          aria-describedby="mail-reply-hint"
        />
        <div id="mail-reply-hint" style={{ fontSize: 11, minHeight: 14 }}>
          {replyToTouched && replyTo && !emailValid && (
            <span style={{ color: "#800000" }}>
              That doesn&apos;t look like a valid email.
            </span>
          )}
          {emailSuggestion && (
            <span style={{ color: "#555" }}>
              Did you mean{" "}
              <button
                type="button"
                onClick={() => setReplyTo(emailSuggestion)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#000080",
                  textDecoration: "underline",
                  cursor: "pointer",
                  font: "inherit",
                  minHeight: 0,
                }}
              >
                {emailSuggestion}
              </button>
              ?
            </span>
          )}
          {replyTo === "" && (
            <span style={{ color: "#555" }}>
              Leave blank if you don&apos;t want a reply.
            </span>
          )}
        </div>
      </div>
      <div className="field-row-stacked">
        <label htmlFor="mail-subject">Subject</label>
        <input
          id="mail-subject"
          type="text"
          placeholder="Hello from danoh.com"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={140}
        />
      </div>
      <div
        className="field-row-stacked"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <label htmlFor="mail-body">Message</label>
        <textarea
          id="mail-body"
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          style={{
            width: "100%",
            flex: 1,
            resize: "vertical",
            minHeight: 120,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
        />
      </div>

      {/* Honeypot — visually hidden + autocomplete off. Humans leave blank. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />

      {status === "error" && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: "#800000",
            background: "#ffd9d9",
            border: "1px solid #800000",
            padding: "6px 8px",
          }}
        >
          {errorMsg}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={close}>
          Cancel
        </button>
      </div>

      <details style={{ marginTop: 4 }}>
        <summary style={{ fontSize: 11, color: "#555", cursor: "pointer" }}>
          Prefer another way?
        </summary>
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 6,
            alignItems: "center",
          }}
        >
          <button type="button" onClick={openInMailClient}>
            Open in mail app
          </button>
          <button type="button" onClick={copyEmail}>
            {copied ? "Copied!" : `Copy ${CONTACT_EMAIL}`}
          </button>
        </div>
      </details>
    </form>
  );
}
