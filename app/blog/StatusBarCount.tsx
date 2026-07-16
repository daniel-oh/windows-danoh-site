"use client";

import { useSyncExternalStore } from "react";
import { getSearchStatus, subscribeSearchStatus } from "./searchStatus";

// Explorer's status bar showed the FILTERED object count; two counts
// on one page that disagree mid-search is worse than none. This cell
// tracks the search island via the external store in searchStatus.ts.
export function StatusBarCount({ total }: { total: number }) {
  const status = useSyncExternalStore(
    subscribeSearchStatus,
    getSearchStatus,
    () => null // server snapshot: no search can be active before hydration
  );
  if (status?.active) {
    return (
      <>
        {status.matched} of {status.total} posts
      </>
    );
  }
  return (
    <>
      {total} {total === 1 ? "post" : "posts"}
    </>
  );
}

// Sibling status cell: names the applied topic filters, or teaches the
// `/` shortcut when nothing is filtered. Same external-store bridge as
// the count above. The server snapshot is null, so SSR deterministically
// renders the shortcut hint.
export function StatusBarHint() {
  const status = useSyncExternalStore(
    subscribeSearchStatus,
    getSearchStatus,
    () => null
  );
  const topics = status?.topics ?? [];
  return <>{topics.length ? `topic: ${topics.join(" + ")}` : "press / to search"}</>;
}
