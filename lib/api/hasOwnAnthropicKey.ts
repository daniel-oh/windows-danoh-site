// Shared detector for visitor-supplied Anthropic API keys. Used by
// every access + cost gate on AI endpoints so the pattern-matching
// stays in one place. Keys this form bypass our rate limits and
// access-code gates — the visitor is paying their own Anthropic bill.
//
// Reads the key from the POST body ONLY, the same place the routes read
// it (lib/getSettingsFromRequest.ts). This used to also accept a
// `?settings=` query param left over from the old GET /api/program. The
// routes had stopped reading it, so a fake well-formed key in the query
// string skipped every gate while the call itself fell back to the
// server's ANTHROPIC_API_KEY. The gate and the route must always agree
// on where the key lives.

const ANTHROPIC_KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{80,}$/;

export function isOwnAnthropicKey(key: unknown): key is string {
  return typeof key === "string" && ANTHROPIC_KEY_PATTERN.test(key);
}

export async function hasOwnAnthropicKey(req: Request): Promise<boolean> {
  if (req.method !== "POST") return false;
  try {
    // Clone so the route handler can still consume the body.
    const body = await req.clone().json();
    return isOwnAnthropicKey(body?.settings?.apiKey);
  } catch {
    /* unparseable body: treat as no key */
    return false;
  }
}
