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
import styles from "./Help.module.css";
import imageIcon from "@/components/assets/image.png";
import wrappedFetch from "@/lib/wrappedFetch";
import { AccessCodePrompt } from "../AccessCodePrompt";

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

const makePrompt = (program: ProgramEntry, keys: string[]) => {
  return `You are the developer of this danoh.com application. Here is its current source:

\`\`\`html
${program.code}
\`\`\`

OS APIs available on window:
${getApiText(keys)}

Rules:
- ALWAYS return the COMPLETE updated HTML wrapped in \`\`\`html markers when the user reports any bug, issue, or requests any change. Do not just explain — fix it and return the full code.
- Only omit code if the user is asking a pure question with no change requested.
- Keep explanations brief. Focus on returning working code.
- The returned HTML must be a complete standalone document wrapped in <html> tags.
`;
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
  assert(
    targetWindow.program.type === "iframe",
    "Target window is not an iframe"
  );

  const programID = targetWindow.program.programID;

  useEffect(() => {
    if (!targetWindow) {
      windowsListDispatch({
        type: "REMOVE",
        payload: id,
      });
    }
  }, [id, targetWindow, windowsListDispatch]);

  const program = useAtomValue(programAtomFamily(programID));

  const keys = getRegistryKeys(registry);

  const [messages, setMessages] = useState<Messages>(() => [
    { role: "system", content: makePrompt(program!, keys) },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

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

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64data = event.target?.result as string;
            setAttachment(base64data);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64data = event.target?.result as string;
        setAttachment(base64data);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatBox} role="log" aria-label="Chat messages">
        <ChatMessage
          msg={{
            role: "system",
            content:
              "Hey! I built this app. Describe any bug or change — I'll fix the code and update the app automatically. \n\n**What needs fixing?**",
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
      {needsAuth ? (
        <div style={{ padding: "0 10px 10px" }}>
          <AccessCodePrompt
            message="Session expired. Enter access code to continue:"
            onSuccess={() => {
              setNeedsAuth(false);
              setIsLoading(false);
            }}
          />
        </div>
      ) : (
      <div className={styles.chatInput}>
        <div
          role="button"
          tabIndex={0}
          title="Attach image"
          onClick={() => fileInputRef.current?.click()}
          style={{ marginRight: 5 }}
        >
          <img
            src={attachment ? attachment : imageIcon.src}
            alt="Attached Image"
            width={24}
            height={24}
            className={styles.thumbnail}
            onClick={() => setAttachment(null)}
          />
        </div>
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

