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
  messages: RawMessage[],
  maxCount = 20
): SanitizedMessage[] {
  return messages
    .filter(
      (m): m is SanitizedMessage =>
        m.role === "user" || m.role === "assistant"
    )
    .slice(-maxCount)
    .map((m) => ({ ...m, content: truncateContent(m.content) }));
}

export function sanitizeWithSystem(
  messages: RawMessage[],
  maxCount = 20
): SanitizedMessage[] {
  const systemMsg = messages.find(
    (m): m is SanitizedMessage => m.role === "system"
  );
  const conversationMsgs = messages
    .filter(
      (m): m is SanitizedMessage =>
        m.role === "user" || m.role === "assistant"
    )
    .slice(-maxCount)
    .map((m) => ({ ...m, content: truncateContent(m.content) }));
  return systemMsg
    ? [{ ...systemMsg, content: truncateContent(systemMsg.content) }, ...conversationMsgs]
    : conversationMsgs;
}
