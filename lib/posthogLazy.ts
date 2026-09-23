"use client";

import { isAnalyticsOptedOut } from "./analyticsOptOut";

type PostHogClient = typeof import("posthog-js").default;

let loaded: PostHogClient | null = null;
let loading: Promise<PostHogClient | null> | null = null;

// posthog-js is ~50KB gzipped and used to sit in the main bundle via a
// static import in the provider. Nothing needs it synchronously — the
// SDK queues nothing before a visitor interaction we care about — so
// it's dynamic-imported off the critical path. Resolves null when the
// key is absent (the deployed default until the secret is set) or on
// the server.
//
// Gated on the key, NOT isLocal(), for the reason lib/capture.ts gives:
// production runs in local mode. It only worked before because the flag
// was missing at image build time and so read as false in the browser;
// setting it there (as the Dockerfile now does) would have switched
// analytics off without a word.
export function loadPosthog(): Promise<PostHogClient | null> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (typeof window === "undefined" || !key) {
    return Promise.resolve(null);
  }
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = import("posthog-js")
      .then((mod) => {
        const ph = mod.default;
        ph.init(key, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
          person_profiles: "identified_only",
        });
        // Respect the persisted opt-out immediately, but keep the
        // instance alive so Settings can opt back in without a reload.
        if (isAnalyticsOptedOut()) ph.opt_out_capturing();
        loaded = ph;
        return ph;
      })
      .catch(() => null);
  }
  return loading;
}
