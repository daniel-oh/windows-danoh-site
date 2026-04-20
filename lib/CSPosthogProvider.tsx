"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { isLocal } from "@/lib/isLocal";
import { isAnalyticsOptedOut } from "@/lib/analyticsOptOut";

// PostHog always initializes in prod so the Settings toggle can flip
// capture on/off without a page reload. When the visitor's persisted
// opt-out flag is set we immediately call opt_out_capturing(), which
// stops events from being sent but keeps the instance alive for a
// later opt-in. This avoids the earlier "opt back in after an opted-
// out page load = silent no-op because posthog was never init'd" trap.
if (typeof window !== "undefined" && !isLocal()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: "identified_only",
  });
  if (isAnalyticsOptedOut()) {
    posthog.opt_out_capturing();
  }
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
