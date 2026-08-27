import Image from "next/image";
import styles from "./SitePreview.module.css";

// An inline portfolio preview for MDX posts: a committed screenshot
// framed as a Win98 window (title bar = the domain, a screenshot well,
// a "visit" footer), the whole thing a link to the live site. The
// on-brand danoh.com cousin of floeberg.com's SitePreview browser card.
//
// Shots live in /public/blog/work/<slug>.jpg at 1280x800 (16:10),
// copied from the landing-page portfolio capture set. Server component:
// the image ships with the post, no client JS.

// domain -> shot slug: strip the TLD and any punctuation. "312built.com"
// -> "312built", "amtraininghall.com" -> "amtraininghall".
export function shotSlug(domain: string): string {
  return domain
    .replace(/\.[a-z]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

export type SitePreviewProps = {
  /** Bare domain, e.g. "floeberg.com". Also the title-bar label + link. */
  domain: string;
  /** Human name, used for alt text. */
  name: string;
  /** Optional italic caption below the frame. */
  caption?: string;
  /** Override the derived shot filename slug if it differs from the domain. */
  slug?: string;
};

export function SitePreview({ domain, name, caption, slug }: SitePreviewProps) {
  const file = slug ?? shotSlug(domain);
  return (
    <figure className={styles.figure}>
      <a
        href={`https://${domain}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.window}
      >
        <div className={styles.titleBar}>
          {/* Folded-corner document glyph, drawn inline (crispEdges). */}
          <svg
            className={styles.icon}
            viewBox="0 0 16 16"
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path d="M3 1h8l3 3v11H3z" fill="#fff" />
            <path d="M11 1l3 3h-3z" fill="#c0c0c0" />
            <path d="M3 1h8l3 3v11H3V1zm1 1v12h9V5h-3V2H4z" fill="#0a0a0a" />
            <path d="M5 6h7v1H5zm0 2h7v1H5zm0 2h5v1H5z" fill="#000080" />
          </svg>
          <span className={styles.domain}>{domain}</span>
          <span className={styles.controls} aria-hidden="true">
            <span className={styles.ctl}>_</span>
            <span className={styles.ctl}>▢</span>
            <span className={styles.ctl}>×</span>
          </span>
        </div>
        <div className={styles.shot}>
          <Image
            src={`/blog/work/${file}.jpg`}
            alt={`${name} website preview`}
            width={1280}
            height={800}
            sizes="(max-width: 760px) 100vw, 672px"
            className={styles.image}
          />
        </div>
        <div className={styles.visit} aria-hidden="true">
          <span>{name}</span>
          <span>visit {domain} ↗</span>
        </div>
      </a>
      {caption && <figcaption className={styles.figcaption}>{caption}</figcaption>}
    </figure>
  );
}
