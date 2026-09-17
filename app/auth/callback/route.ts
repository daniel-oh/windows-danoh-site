import { createClient } from "@/lib/supabase/server";
import { relativeRedirect } from "@/lib/relativeRedirect";

// Whitelist same-origin paths only. `?next=//evil.com` would
// otherwise be interpreted as a protocol-relative URL and let an
// attacker phish a valid OAuth flow into a redirect to their domain.
// "/" is the safe fallback for anything that doesn't start with a
// single forward slash followed by a non-slash character.
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  // Must start with "/" and the second char must NOT be another "/"
  // or a backslash (avoids `//`, `/\`, and Windows-style traversal).
  if (!/^\/[^/\\]/.test(raw)) return "/";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    // createClient throws when Supabase isn't configured (local mode,
    // i.e. prod today). That is a failed sign-in, not a 500.
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return relativeRedirect(next);
      }
    } catch {
      /* fall through to /error */
    }
  }

  return relativeRedirect("/error");
}
