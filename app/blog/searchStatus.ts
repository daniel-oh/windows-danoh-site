// Tiny external store bridging two client islands that have no shared
// React parent: BlogIndexContent (inside <main>, owns the filter) and
// StatusBarCount (in the page shell's status bar). Pulling Jotai into
// the otherwise-static blog shell for one number isn't worth the bytes.

export type SearchStatus = {
  active: boolean;
  matched: number;
  total: number;
  /** Topic-chip filters currently applied (shown in the status bar hint). */
  topics: string[];
};

let status: SearchStatus | null = null;
const listeners = new Set<() => void>();

export function publishSearchStatus(next: SearchStatus | null) {
  status = next;
  listeners.forEach((l) => l());
}

export function subscribeSearchStatus(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSearchStatus() {
  return status;
}
