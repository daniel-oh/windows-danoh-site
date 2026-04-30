// "External link" / "open in new" indicator. Renders as an
// upper-right chevron next to link text.
//
// Pure CSS (no SVG, no Unicode glyph) so the render path can't fail
// on a missing font glyph or an iOS WebKit currentColor-on-stroke
// quirk. Two borders on a rotated <span> form the corner shape;
// currentColor on a CSS border is one of the most universally
// supported inherit-the-text-color mechanisms in the platform.
//
// Sized at 9 px square / 2 px border. Visible diagonal after
// rotation works out to ~13 px corner-to-corner — clearly readable
// against 13–15 px body text without overpowering it. Em-relative
// vertical-align so the glyph centers on the cap height rather
// than the baseline.

export function ExternalArrow({ size = 9 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        marginLeft: 6,
        marginRight: 1,
        borderTop: "2px solid currentColor",
        borderRight: "2px solid currentColor",
        transform: "rotate(45deg)",
        verticalAlign: "0.05em",
        flexShrink: 0,
      }}
    />
  );
}
