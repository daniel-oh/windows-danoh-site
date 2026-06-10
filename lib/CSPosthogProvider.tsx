"use client";
import { useEffect } from "react";
import { loadPosthog } from "./posthogLazy";

// Formerly wrapped children in posthog-js/react's PostHogProvider with
// a static posthog import — which put the whole SDK in the main bundle
// even though no component uses the usePostHog hook. Now it just kicks
// off the lazy init once the main thread is idle; capture call sites
// go through lib/posthogLazy.
export function CSPostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const kickoff = () => void loadPosthog();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(kickoff, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(kickoff, 2000);
    return () => clearTimeout(t);
  }, []);
  return <>{children}</>;
}
