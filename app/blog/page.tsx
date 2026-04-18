import Link from "next/link";
import type { Metadata } from "next";
import { sortedPosts } from "@/content/blog/posts";
import styles from "./blog.module.css";

export const metadata: Metadata = {
  title: "Blog · Daniel Oh",
  description:
    "Writing from Daniel Oh on AI, craft, and the work of building things that last.",
  alternates: { canonical: "https://danoh.com/blog" },
  openGraph: {
    title: "Blog · Daniel Oh",
    description:
      "Writing from Daniel Oh on AI, craft, and the work of building things that last.",
    url: "https://danoh.com/blog",
    type: "website",
  },
};

export default function BlogIndex() {
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.titleBar}>
          <div className={styles.titleBarText}>Blog · danoh.com</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop ↗
          </Link>
        </div>
        <header className={styles.tagline}>
          <div className={styles.taglineLine1}>
            Engineer who designs. Operator who writes.
          </div>
          <div className={styles.taglineLine2}>
            AI, craft, and the work of building things that last.
          </div>
        </header>
        <div className={styles.body}>
          <h1 className={styles.postHeading} style={{ fontSize: 22 }}>
            Writing
          </h1>
          <ul className={styles.index}>
            {sortedPosts.map((post) => (
              <li key={post.slug} className={styles.indexItem}>
                <div className={styles.indexTitle}>
                  {post.pinned && (
                    <span className={styles.pinnedBadge}>Pinned</span>
                  )}
                  <Link
                    href={`/blog/${post.slug}`}
                    className={styles.footerLink}
                  >
                    {post.title}
                  </Link>
                </div>
                <p className={styles.indexSummary}>{post.summary}</p>
                <div className={styles.indexMeta}>
                  {post.date} · {post.author}
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.footer}>
            <Link href="/" className={styles.footerLink}>
              ← Back to the desktop
            </Link>
            <a href="/feed.xml" className={styles.footerLink}>
              RSS ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
