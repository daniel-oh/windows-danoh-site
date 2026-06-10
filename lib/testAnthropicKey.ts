// One key probe shared by Settings and the Run gate's BYOK path. The
// request goes straight from the visitor's browser to Anthropic — the
// key never touches our server during validation. That fact is part of
// the privacy copy shown next to both inputs, so keep it true.
export async function testAnthropicKey(
  key: string
): Promise<"valid" | "invalid"> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    // Auth failures mean a bad key; anything else (429, 529) proves
    // the key is real even if the probe call itself got throttled.
    if (res.status === 401 || res.status === 403) return "invalid";
    return "valid";
  } catch {
    return "invalid";
  }
}
