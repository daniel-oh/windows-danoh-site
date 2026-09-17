import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { relativeRedirect } from "@/lib/relativeRedirect";

// Creating a handler to a GET request to route /auth/confirm
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = "/";

  // Redirect target keeps the visitor's other params but never the
  // secret token.
  const params = new URLSearchParams(searchParams);
  params.delete("token_hash");
  params.delete("type");
  const withQuery = (path: string) => {
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  if (token_hash && type) {
    // createClient throws when Supabase isn't configured (local mode,
    // i.e. prod today). That is a failed confirmation, not a 500.
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
      });
      if (!error) {
        params.delete("next");
        return relativeRedirect(withQuery(next));
      }
    } catch {
      /* fall through to /error */
    }
  }

  // return the user to an error page with some instructions
  return relativeRedirect(withQuery("/error"));
}
