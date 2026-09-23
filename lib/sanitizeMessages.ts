type RawMessage = { role: string; content: any };
type SanitizedMessage = { role: "user" | "assistant" | "system"; content: any };

const MAX_CONTENT_LENGTH = 50000; // ~50KB per message
// Per-block caps alone let a request carry any number of 50 KB blocks,
// which is how one call could reach ~900k input tokens. These bound the
// whole conversation.
const MAX_BLOCKS = 20;
const MAX_TOTAL_CHARS = 200_000;

function truncateContent(content: any): any {
  if (typeof content === "string") {
    return content.length > MAX_CONTENT_LENGTH
      ? content.slice(0, MAX_CONTENT_LENGTH)
      : content;
  }
  if (Array.isArray(content)) {
    return content.slice(0, MAX_BLOCKS).map((c: any) => {
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
  const recent = (messages as RawMessage[])
    .filter(
      (m): m is SanitizedMessage =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant")
    )
    .slice(-maxCount)
    .map((m) => ({ ...m, content: truncateContent(m.content) }));
  // Keep the newest turns that fit the total, oldest dropped first: the
  // latest message is the one that has to be answered.
  const kept: SanitizedMessage[] = [];
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const size = JSON.stringify(recent[i].content ?? "").length;
    // The newest turn always stays (the route's body limit bounds it).
    if (kept.length > 0 && total + size > MAX_TOTAL_CHARS) break;
    total += size;
    kept.unshift(recent[i]);
  }
  return kept;
}

