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
import { alert } from "@/lib/alert";
import { registerCloseGuard } from "@/lib/windowCloseGuards";

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
  // Set in the mount effect below — Date.now() in the initializer is
  // an impure render per the react-hooks purity rules.
  const mountedAtRef = useRef(0);

  const emailValid = replyTo === "" || EMAIL_RE.test(replyTo.trim());
  const emailSuggestion = suggestEmailFix(replyTo.trim());
  // Guard on the content fields only: a subject or message of ANY length
  // is work worth a confirm (the old combined >10 threshold let a short
  // typed message close silently), while a lone autofilled name/email
  // isn't a draft.
  const hasDraft = subject.trim().length > 0 || body.trim().length > 0;

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  // Draft protection as a registered close guard, not logic inside a
  // local close() — the title-bar X, Esc, and every other close path
  // dispatch REMOVE directly and would otherwise bypass the confirm.
  // The dialog is the in-house one, not window.confirm: native chrome
  // is the one place the Win98 costume would slip, and it happens
  // mid-contact-flow.
  useEffect(() => {
    if (status === "sent" || !hasDraft) return;
    return registerCloseGuard(id, () => {
      alert({
        alertId: `mail-discard-${id}`,
        title: "New Message",
        icon: "x",
        message: "This message hasn't been sent. Close anyway?",
        actions: [
          { label: "Keep writing", callback: (closeAlert) => closeAlert() },
          {
            label: "Discard",
            callback: (closeAlert) => {
              closeAlert();
              windowsDispatch({ type: "REMOVE", payload: id, force: true });
            },
          },
        ],
      });
      return false;
    });
  }, [id, status, hasDraft, windowsDispatch]);

  const close = () => {
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
        {/* Buttons-with-onClick rather than the previous <button> nested
         * inside <a target="_blank">. Interactive-inside-interactive
         * is invalid HTML and breaks iOS double-tap-zoom + some
         * screen readers. window.open with noopener,noreferrer is
         * the same effect. */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() =>
              window.open(CONTACT_LINKEDIN, "_blank", "noopener,noreferrer")
            }
          >
            Message on LinkedIn
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(CONTACT_GITHUB, "_blank", "noopener,noreferrer")
            }
          >
            GitHub
          </button>
          <button onClick={close}>Close</button>
        </div>
      </div>
    );
  }

  // Delivered — confirmation state
  if (status === "sent") {
    return (
      <div
        role="status"
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
          <div style={{ fontSize: 12, color: "#444" }}>
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
      <p style={{ fontSize: 12, color: "#444", margin: 0 }}>
        Sends straight to my inbox.
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
            <span style={{ color: "#444" }}>
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
            <span style={{ color: "#444" }}>
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
        {/* Counter appears only when the 4000 cap is in sight —
         * permanent counters read as bureaucracy on a contact form. */}
        {body.length >= 3500 && (
          <div
            aria-live="polite"
            style={{
              fontSize: 11,
              color: body.length >= 3900 ? "#800000" : "#444",
              textAlign: "right",
            }}
          >
            {body.length}/4000
          </div>
        )}
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
        <summary style={{ fontSize: 11, color: "#444", cursor: "pointer" }}>
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
