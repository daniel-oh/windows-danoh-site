// Inline SVG replacement for the bare "↗" Unicode character. Mobile
// fonts (especially the iOS / Android system fallback chain after
// Inter) often don't ship a glyph for U+2197 NORTH EAST ARROW, which
// renders as tofu (a black box) on those devices. SVG is universal,
// uses currentColor so it inherits whatever text color it sits in,
// and aria-hidden so screen readers don't narrate it (the surrounding
// link text already conveys the action).

export function ExternalArrow({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{
        display: "inline-block",
        verticalAlign: "-1px",
        marginLeft: 3,
        flexShrink: 0,
      }}
    >
      <path d="M3.5 8.5 L8.5 3.5" />
      <path d="M4.5 3.5 L8.5 3.5 L8.5 7.5" />
    </svg>
  );
}
