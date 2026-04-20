// Persisted analytics opt-out flag. Lives in localStorage (not the
// sessionStorage-backed settings atom) because the choice is about
// the visitor as a person, not about one browser session — they don't
// want to re-opt-out on every tab.
//
// Read at PostHog init time (see CSPosthogProvider) and also at the
// Settings toggle (see Settings.tsx). Writes from the Settings toggle
// call posthog.opt_out_capturing() / opt_in_capturing() so the change
// takes effect without a page reload.

const KEY = "danoh_analytics_opt_out";

export function isAnalyticsOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setAnalyticsOptedOut(optedOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optedOut) window.localStorage.setItem(KEY, "true");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* swallow storage errors — private-mode / quota */
  }
}
