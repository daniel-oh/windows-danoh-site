"use client";

import {
  ProgramEntry,
  programAtomFamily,
  programsAtom,
} from "@/state/programs";
import { registryAtom } from "@/state/registry";
import { windowAtomFamily } from "@/state/window";
import { windowsListAtom } from "@/state/windowsList";
import { getApiText } from "@/lib/apiText";
import { assert } from "@/lib/assert";
import { getRegistryKeys } from "@/lib/getRegistryKeys";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState, useRef } from "react";
import Markdown from "react-markdown";
import { getSettings } from "@/lib/getSettings";
import { settingsAtom } from "@/state/settings";
import styles from "./Help.module.css";
import imageIcon from "@/components/assets/image.png";
import wrappedFetch from "@/lib/wrappedFetch";
import { AccessCodePrompt } from "../AccessCodePrompt";
import { ByokPrompt } from "../ByokPrompt";

// Fix & Iterate calls the AI (and would spend tokens / the shared
// budget), so it's gated exactly like the Run dialog: a visitor needs
// an access-code session or their own Anthropic key before they can
// prompt it. document.cookie is the same signal Run uses.
function hasSession() {
  return (
    typeof document !== "undefined" && document.cookie.includes("lr_session=")
  );
}

type Message = {
  role: string;
  content:
    | string
    | (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[];
};

type Messages = Message[];

// Attachment ceiling — see attachImage() for the rationale.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// The app context only — the behavioral rules + guardrails live
// server-side (lib/helpPrompt.ts), which wraps this as untrusted data so
// a client can't substitute its own system prompt. Sent as the first
// "system" message; the server re-frames it.
const makePrompt = (program: ProgramEntry | undefined, keys: string[]) => {
  return `Here is the app's current source:

\`\`\`html
${program?.code ?? ""}
\`\`\`

OS APIs available on window:
${getApiText(keys)}`;
};

function extractHtmlFromResponse(str: string): string | null {
  const codeStart = str.indexOf("```html");
  if (codeStart === -1) return null;
  const htmlStart = str.indexOf("<html>", codeStart);
  const htmlEnd = str.indexOf("</html>", htmlStart);
  if (htmlStart === -1 || htmlEnd === -1) return null;
  return str.slice(htmlStart + 6, htmlEnd);
}

function hasHtmlCodeBlock(str: string): boolean {
  return str.includes("```html") && str.includes("</html>");
}

function stripHtmlCodeBlock(str: string): string {
  const codeStart = str.indexOf("```html");
  if (codeStart === -1) return str;
  const htmlEnd = str.indexOf("</html>", codeStart);
  if (htmlEnd === -1) return str;
  // Find the closing ``` after </html>
  const closingTicks = str.indexOf("```", htmlEnd);
  const blockEnd = closingTicks !== -1 ? closingTicks + 3 : htmlEnd + 7;
  return str.slice(0, codeStart) + str.slice(blockEnd);
}

const trimMessages = (msgs: Messages) => {
  const system = msgs.filter(m => m.role === "system");
  const rest = msgs.filter(m => m.role !== "system").slice(-48);
  return [...system, ...rest];
};

export function Help({ id }: { id: string }) {
  const helpWindow = useAtomValue(windowAtomFamily(id));
  const windowsListDispatch = useSetAtom(windowsListAtom);
  const registry = useAtomValue(registryAtom);
  assert(
    helpWindow.program.type === "help" && helpWindow.program.targetWindowID,
    "Help window must have a target window ID"
  );
  const targetWindow = useAtomValue(
    windowAtomFamily(helpWindow.program.targetWindowID)
  );
  const programsDispatch = useSetAtom(programsAtom);
  // windowsList REMOVE closes this window when its target goes, but the
  // family can hand back a default ("welcome") atom for a closed id in
  // the render between the two removals. Degrade to a notice instead of
  // asserting; an assert here escapes to the root error boundary and
  // takes the whole desktop down with it.
  const programID =
    targetWindow.program.type === "iframe" ? targetWindow.program.programID : "";
  const targetGone = targetWindow.program.type !== "iframe";

  useEffect(() => {
    if (targetGone) {
      windowsListDispatch({ type: "REMOVE", payload: id, force: true });
    }
  }, [id, targetGone, windowsListDispatch]);

  const program = useAtomValue(programAtomFamily(programID));

  const keys = getRegistryKeys(registry);

  const [messages, setMessages] = useState<Messages>(() => [
    { role: "system", content: makePrompt(program, keys) },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  // Proactive gate: don't even show the prompt input without auth (the
  // old flow let you type and send, then only surfaced the gate after
  // the server's 401). Lazy init from the synchronous signals so a
  // keyed/sessioned user never sees a flash of the gate.
  const settings = useAtomValue(settingsAtom);
  const [authed, setAuthed] = useState(
    () => hasSession() || !!getSettings().apiKey
  );
  useEffect(() => {
    if (settings.apiKey) setAuthed(true);
  }, [settings.apiKey]);

  const doSend = async (allMessages: Messages) => {
    try {
      const response = await wrappedFetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          settings: getSettings(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setNeedsAuth(true);
        } else {
          setMessages(trimMessages([
            ...allMessages,
            { role: "assistant", content: "The AI service is temporarily unavailable. Please try again in a moment." },
          ]));
        }
        return;
      }

      const data = await response.json();

      if (typeof data === "string") {
        const extracted = extractHtmlFromResponse(data);
        if (extracted) {
          const fixedCode = `<!DOCTYPE html><html>${extracted}</html>`;
          // Auto-apply: persist to filesystem
          try {
            await programsDispatch({
              type: "UPDATE_PROGRAM",
              payload: { id: programID, code: fixedCode },
            });
          } catch (e) {
            console.error("Failed to persist fix:", e);
          }
          // Instant visual update: directly set iframe srcDoc
          const targetWindowId = helpWindow.program.type === "help" ? helpWindow.program.targetWindowID : null;
          if (targetWindowId) {
            const iframe = document.getElementById(`iframe-${targetWindowId}`) as HTMLIFrameElement | null;
            if (iframe) {
              iframe.srcdoc = fixedCode;
            }
          }
        }
        setMessages(trimMessages([...allMessages, { role: "assistant", content: data }]));
      } else {
        setMessages(trimMessages([
          ...allMessages,
          { role: "assistant", content: "Received an unexpected response. Please rephrase your request and try again." },
        ]));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(trimMessages([
        ...allMessages,
        { role: "assistant", content: "Couldn't connect to the server. Check your internet connection and try again." },
      ]));
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessageWithText = async (text: string) => {
    const newMessage = {
      role: "user",
      content: [
        { type: "text", text } as const,
      ].filter(Boolean),
    } as Message;
    setMessages([...messages, newMessage]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    await doSend([...messages, newMessage]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessage = {
      role: "user",
      content: [
        { type: "text", text: input } as const,
        attachment
          ? ({ type: "image_url", image_url: { url: attachment } } as const)
          : null,
      ].filter(Boolean),
    } as Message;
    setMessages([...messages, newMessage]);
    setInput("");
    setAttachment(null);
    setIsLoading(true);

    await doSend([...messages, newMessage]);
  };

  const attachImage = (file: File) => {
    // Cap before reading: a phone photo can be 20MB+, which base64s
    // to ~1.33x in the JSON body the server has to parse before any
    // rate limit sees it. 5MB is plenty for a bug screenshot.
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError("That image is too big. 5 MB max.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment(event.target?.result as string);
      setUploadError(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) attachImage(blob);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachImage(file);
    // Reset so picking the same file again (after removing it) refires
    // the change event.
    e.target.value = "";
  };

  if (targetGone) {
    return (
      <div className={styles.chatContainer} role="status" style={{ padding: 8 }}>
        That app window was closed. Reopen the app and press its ? button
        to keep iterating.
      </div>
    );
  }

  return (
    <div className={styles.chatContainer}>
      {/* aria-busy keeps the log's letter-by-letter LOADING indicator
       * from being spelled out into a screen reader one span at a time. */}
      <div
        className={styles.chatBox}
        role="log"
        aria-label="Chat messages"
        aria-busy={isLoading}
      >
        <ChatMessage
          msg={{
            role: "system",
            content:
              "Hey! I built this app. Describe any bug or change, and I'll fix the code and update the app automatically. \n\n**What needs fixing?**",
          }}
          onRequestFix={() => {}}
          isLastAssistant={false}
        />
        {(() => {
          const visibleMessages = messages.filter((msg) => msg.role !== "system");
          const lastAssistantIndex = visibleMessages.length - 1 -
            [...visibleMessages].reverse().findIndex((m) => m.role === "assistant");
          return visibleMessages.map((msg, index) => (
            <ChatMessage
              key={index}
              msg={msg}
              onRequestFix={() => {
                sendMessageWithText("Based on what you identified above, apply the fix now. Return the COMPLETE updated HTML document with the fix applied.");
              }}
              isLastAssistant={msg.role === "assistant" && index === lastAssistantIndex}
            />
          ));
        })()}
        {isLoading && (
          <div className={styles.loadingIndicator}>
            <span>L</span>
            <span>O</span>
            <span>A</span>
            <span>D</span>
            <span>I</span>
            <span>N</span>
            <span>G</span>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        )}
      </div>
      {!authed || needsAuth ? (
        <div
          style={{
            padding: "0 10px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <p style={{ fontSize: 12, color: "#444", margin: 0 }}>
            {needsAuth
              ? "Session expired. Add your Anthropic key or an access code to keep editing."
              : "Fix & Iterate edits this app with AI. Add your own Anthropic key or an access code to use it."}
          </p>
          <fieldset>
            <legend>Use your own Anthropic key</legend>
            <ByokPrompt
              onSuccess={() => {
                setAuthed(true);
                setNeedsAuth(false);
              }}
            />
          </fieldset>
          <fieldset>
            <legend>Or enter an access code</legend>
            <AccessCodePrompt
              byokHint={false}
              onSuccess={() => {
                setAuthed(true);
                setNeedsAuth(false);
                setIsLoading(false);
              }}
            />
          </fieldset>
        </div>
      ) : (
      <>
      {uploadError && (
        <div
          role="alert"
          style={{ padding: "0 10px 4px", fontSize: 11, color: "#800000" }}
        >
          {uploadError}
        </div>
      )}
      <div className={styles.chatInput}>
        {/* One real <button>, one state-dependent action. The old
         * div+img pair had onClick on both layers, so tapping the
         * thumbnail cleared the attachment AND bubbled up to reopen
         * the file picker — and as a div it had no keyboard support. */}
        <button
          type="button"
          aria-label={attachment ? "Remove attached image" : "Attach image"}
          title={attachment ? "Remove attached image" : "Attach image"}
          onClick={() => {
            if (attachment) setAttachment(null);
            else fileInputRef.current?.click();
          }}
          style={{
            marginRight: 5,
            minWidth: 0,
            minHeight: 0,
            padding: 2,
            display: "inline-flex",
          }}
        >
          <img
            src={attachment ? attachment : imageIcon.src}
            alt=""
            width={24}
            height={24}
            className={styles.thumbnail}
          />
        </button>
        <input
          type="text"
          aria-label="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage()}
          onPaste={handlePaste}
          disabled={isLoading}
          style={{ height: "100%" }}
        />

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button aria-label="Send message" onClick={sendMessage} disabled={isLoading}>
          Send
        </button>
      </div>
      </>
      )}
    </div>
  );
}

function ChatMessage({
  msg,
  onRequestFix,
  isLastAssistant,
}: {
  msg: Message;
  onRequestFix: () => void;
  isLastAssistant: boolean;
}) {
  const str =
    typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((item) => item.text)
          .join("");

  const attachments =
    typeof msg.content === "string"
      ? []
      : msg.content.filter(
          (c): c is { type: "image_url"; image_url: { url: string } } =>
            c.type === "image_url"
        );

  const hasCode = hasHtmlCodeBlock(str);
  const displayText = hasCode ? stripHtmlCodeBlock(str) : str;

  return (
    <div>
      <div
        className={`${styles.chatMessage} ${
          msg.role === "user" ? styles.user : styles.assistant
        }`}
      >
        {attachments.map((attachment, index) => (
          <img
            key={index}
            src={attachment.image_url.url}
            alt="Attachment"
            style={{ maxWidth: 200, maxHeight: 200, objectFit: "contain" }}
          />
        ))}
        {displayText.trim() && (
          <Markdown className={styles.markdown}>{displayText}</Markdown>
        )}
        {/* Show "Fix applied" confirmation when code was returned */}
        {msg.role === "assistant" && hasCode && (
          <div className={styles.fixActions}>
            <div className={styles.fixApplied}>Fix applied to app</div>
          </div>
        )}
        {/* Show "Fix it for me" when AI explained but didn't return code */}
        {msg.role === "assistant" && !hasCode && isLastAssistant && (
          <div className={styles.fixActions}>
            <button onClick={onRequestFix} className={styles.fixItButton}>
              Fix it for me
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

