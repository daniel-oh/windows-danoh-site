// Programs created by a Run submission that haven't produced code yet.
// Run persists the desktop icon before the generation stream starts, so
// if the stream fails (rate limit, upstream error) or the visitor closes
// the window mid-generation, the icon would otherwise survive as a dead
// entry that re-triggers a gated generation every time it's opened.
// Iframe's close guard consults this set and deletes the entry instead.
//
// Deliberately NOT keyed off "program has no code": File > Reload clears
// the code of a working program to re-enter generation mode, and that
// program must survive a failed reload (its version history restores it).

const pending = new Set<string>();

export function markPendingFirstRun(id: string) {
  pending.add(id);
}

export function resolvePendingFirstRun(id: string) {
  pending.delete(id);
}

export function isPendingFirstRun(id: string) {
  return pending.has(id);
}
