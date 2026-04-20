"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { isLocal } from "@/lib/isLocal";
import { isAnalyticsOptedOut } from "@/lib/analyticsOptOut";

// PostHog init is gated on three things: (1) we're in the browser,
// (2) not local dev, (3) the visitor hasn't opted out via Settings.
// If they toggle opt-out at runtime, Settings.tsx calls
// posthog.opt_out_capturing() — no reload required.
if (typeof window !== "undefined" && !isLocal() && !isAnalyticsOptedOut()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: "identified_only",
  });
}

export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
