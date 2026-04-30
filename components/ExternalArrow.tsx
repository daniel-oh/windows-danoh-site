// Inline SVG replacement for the bare "↗" Unicode character. Mobile
// fonts (especially the iOS / Android system fallback chain after
// Inter) often don't ship a glyph for U+2197 NORTH EAST ARROW, which
// renders as tofu (a black box) on those devices.
//
// Implementation: a filled solid polygon (no strokes). The earlier
// stroke-only version painted as empty space on iOS Safari — a
// known WebKit quirk where stroke="currentColor" + fill="none"
// occasionally evaluates the stroke color before the parent's
// `color` propagates, leaving the path invisible. Filled shapes
// don't have this problem and render identically across every
// engine.
//
// Sized at 13 px by default — bigger than the previous 11 px so
// it's actually legible at body-text scales on small screens. Uses
// currentColor + aria-hidden so it inherits the surrounding link
// color and is invisible to screen readers (the link text already
// conveys the action).

export function ExternalArrow({ size = 13 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{
        display: "inline-block",
        verticalAlign: "-2px",
        marginLeft: 3,
        flexShrink: 0,
        color: "inherit",
      }}
    >
      {/* Material-Design "north_east" filled glyph. Arrowhead in the
       * top-right corner with a chunky diagonal shaft pointing
       * down-left toward the surrounding text. */}
      <path d="M5 17.59 L15.59 7 H9 V5 H19 V15 H17 V8.41 L6.41 19 Z" />
    </svg>
  );
}
