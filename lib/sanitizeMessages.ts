type RawMessage = { role: string; content: any };
type SanitizedMessage = { role: "user" | "assistant" | "system"; content: any };

const MAX_CONTENT_LENGTH = 50000; // ~50KB per message

function truncateContent(content: any): any {
  if (typeof content === "string") {
    return content.length > MAX_CONTENT_LENGTH
      ? content.slice(0, MAX_CONTENT_LENGTH)
      : content;
  }
  if (Array.isArray(content)) {
    return content.map((c: any) => {
      if (typeof c === "object" && c?.type === "text" && typeof c.text === "string") {
        return { ...c, text: c.text.slice(0, MAX_CONTENT_LENGTH) };
      }
      return c;
    });
  }
  return content;
}

export function sanitizeUserMessages(
  messages: unknown,
  maxCount = 20
): SanitizedMessage[] {
  // Request bodies are untrusted: a non-array `messages` used to throw
  // here and surface as a 500.
  if (!Array.isArray(messages)) return [];
  return (messages as RawMessage[])
    .filter(
      (m): m is SanitizedMessage =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant")
    )
    .slice(-maxCount)
    .map((m) => ({ ...m, content: truncateContent(m.content) }));
}

