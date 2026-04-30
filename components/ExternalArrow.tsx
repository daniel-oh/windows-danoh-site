// "External link" / "open in new" indicator. Small upper-right
// chevron next to link text.
//
// Pure CSS (no SVG, no Unicode glyph) so the render path can't fail
// on a missing font glyph or a WebKit currentColor-on-stroke quirk.
// Two borders on a rotated <span> form the corner shape; currentColor
// on a CSS border is one of the most universally supported
// inherit-the-text-color mechanisms.
//
// Sized 8 px / 1.5 px borders by design — calibrated to sit
// confidently next to 11–14 px body text without overpowering it.
// Matches the visual weight of a typical Unicode arrow at this scale.

export function ExternalArrow({ size = 8 }: { size?: number }) {
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
        transform: "rotate(45deg)",
        verticalAlign: "0.06em",
        flexShrink: 0,
      }}
    />
  );
}
