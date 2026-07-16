// 16x16 pixel-art document icon for the blog shell's caption bar —
// every real Win98 window had one at the title's left edge. Inline
// SVG (crispEdges) so it stays sharp and ships zero extra requests.
// Also reused (recolored, resized via className) as the doc icon on
// related-post cards.
import styles from "./blog.module.css";

export function CaptionIcon({
  lineColor = "#000080",
  className,
}: {
  /** Color of the document's text lines. */
  lineColor?: string;
  /** Overrides the default title-bar sizing class. */
  className?: string;
}) {
  return (
    <svg
      className={className ?? styles.titleBarIcon}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d="M3 1h8l3 3v11H3z" fill="#fff" />
      <path d="M11 1l3 3h-3z" fill="#c0c0c0" />
      <path
        d="M3 1h8l3 3v11H3V1zm1 1v12h9V5h-3V2H4z"
        fill="#0a0a0a"
      />
      <path d="M5 6h7v1H5zm0 2h7v1H5zm0 2h5v1H5z" fill={lineColor} />
    </svg>
  );
}
