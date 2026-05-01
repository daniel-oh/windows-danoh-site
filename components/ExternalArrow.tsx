// "External link" / "open in new" indicator.
//
// History of attempts that didn't render for the user:
//   1. "↗" U+2197 NORTH EAST ARROW — tofu (no glyph in mobile font
//      fallback chain).
//   2. SVG with fill="none" + stroke="currentColor" — empty space
//      on iOS Safari (a known WebKit currentColor-on-stroke quirk).
//   3. SVG with fill="currentColor" — also reported empty.
//   4. CSS chevron with two borders + rotate(45deg) — also reported
//      empty even though the styled span verifiably reaches the DOM.
//
// At this point the priority is "actually visible" over "perfectly
// diagonal." Switched to U+2192 RIGHTWARDS ARROW, which is in the
// most-supported part of the Unicode Arrows block (covered by every
// iOS / Android / macOS / Windows system font I know of). It's
// horizontal rather than diagonal, but the surrounding link text
// already conveys "external" — the arrow is a glance-confirming
// cue, not the only signal.
//
// Wrapped in a span with aria-hidden so screen readers don't narrate
// "rightwards arrow" after every link.

export function ExternalArrow() {
  return (
    <span
      aria-hidden="true"
      style={{
        marginLeft: 4,
        display: "inline-block",
        flexShrink: 0,
      }}
    >
      &rarr;
    </span>
  );
}
