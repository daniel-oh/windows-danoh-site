// True on touch devices (phones, most tablets) — the primary pointer is
// coarse and there's no physical keyboard to serve. Used to suppress
// auto-focus on open: programmatic focus there pops the soft keyboard
// and paints a stray :focus-visible ring, a sloppy first impression.
// Deliberately NOT width-based (a narrow desktop window with a mouse
// should still auto-focus), so it checks the pointer, not the viewport.
export function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}
