// Shared detector for visitor-supplied Anthropic API keys. Used by
// every access + cost gate on AI endpoints so the pattern-matching
// stays in one place. Keys this form bypass our rate limits and
// access-code gates — the visitor is paying their own Anthropic bill.
//
// Handles both request shapes we use in practice:
//   GET /api/program?settings={"apiKey":"sk-ant-…"}
//   POST /api/chat   body: { settings: { apiKey: "sk-ant-…" } }

const ANTHROPIC_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{80,}$/;

function isValid(key: unknown): key is string {
  return typeof key === "string" && ANTHROPIC_KEY_PATTERN.test(key);
}

export async function hasOwnAnthropicKey(req: Request): Promise<boolean> {
  try {
    const url = new URL(req.url);
    const settingsParam = url.searchParams.get("settings");
    if (settingsParam) {
      const parsed = JSON.parse(decodeURIComponent(settingsParam));
      if (isValid(parsed?.apiKey)) return true;
    }
    if (req.method === "POST") {
      // Clone so the route handler can still consume the body.
      const body = await req.clone().json().catch(() => null);
      if (isValid(body?.settings?.apiKey)) return true;
    }
  } catch {
    /* ignore parse errors — treat as no key */
  }
  return false;
}
