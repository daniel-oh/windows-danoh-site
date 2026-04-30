// "External link" / "open in new" indicator. Renders as a small
// upper-right chevron next to link text.
//
// Implementation: pure CSS. Two borders on a rotated <span> form
// the corner shape — no SVG, no Unicode, no font fallback chain to
// fail through. The previous attempts (the bare ↗ glyph and a
// stroke-then-fill SVG) both rendered as empty space on at least
// one platform; CSS borders use currentColor reliably across every
// browser.
//
// Sizing chosen so the chevron sits visually balanced against
// 13–15 px body text. Uses currentColor + aria-hidden so it
// inherits the surrounding link color and screen readers skip it.

export function ExternalArrow({ size = 7 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        marginLeft: 5,
        marginRight: 1,
        borderTop: "1.5px solid currentColor",
        borderRight: "1.5px solid currentColor",
        transform: "translateY(-2px) rotate(45deg)",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}
