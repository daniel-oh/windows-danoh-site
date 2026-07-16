// 16x16 pixel-art open-folder icon — the blog index presents itself
// as an Explorer window over C:\danoh\blog, and Explorer windows had
// folder icons, not document icons, in their caption bars. Inline SVG
// for the same sharpness/zero-request reasons as CaptionIcon.
import styles from "./blog.module.css";

export function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? styles.titleBarIcon}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d="M1 3h5l2 2h7v9H1z" fill="#ffe97f" />
      <path d="M1 3h5l2 2h7v1H1z" fill="#fff59d" />
      <path d="M0 2h6l2 2h8v11H0V2zm1 1v9h14V5H7L5 3H1z" fill="#0a0a0a" />
    </svg>
  );
}
