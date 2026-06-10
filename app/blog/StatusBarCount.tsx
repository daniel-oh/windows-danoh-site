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
