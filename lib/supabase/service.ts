import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/generated/supabase/types";

// Service-role client: bypasses row-level security. The cookie-backed
// clients in server.ts / middleware.ts run as the visitor (anon key +
// their session) so RLS decides what they see; this one is for the few
// server-only paths that legitimately act on behalf of nobody (Stripe
// webhook crediting a purchase, icon upload to a public bucket).
// Never import it from anything that handles a user request's data.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase service client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY"
    );
  }
  return createClient<Database>(url, key, {
    // No browser, no session: a plain bearer for the service key.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
