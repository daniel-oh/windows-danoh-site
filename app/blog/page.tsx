import Link from "next/link";
import type { Metadata } from "next";
import { sortedPosts, type BlogPost } from "@/content/blog/posts";
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

type PostGroup = { label: string; posts: BlogPost[] };

function groupPosts(posts: BlogPost[]): PostGroup[] {
  const pinned = posts.filter((p) => p.pinned);
  const unpinned = posts.filter((p) => !p.pinned);
  const byYear = new Map<string, BlogPost[]>();
  for (const post of unpinned) {
    const year = post.date.slice(0, 4);
    const existing = byYear.get(year);
    if (existing) existing.push(post);
    else byYear.set(year, [post]);
  }
  const yearGroups: PostGroup[] = [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, posts]) => ({ label: year, posts }));
  return pinned.length > 0
    ? [{ label: "Pinned", posts: pinned }, ...yearGroups]
    : yearGroups;
}

export default function BlogIndex() {
  const groups = groupPosts(sortedPosts);
  const totalPosts = sortedPosts.length;
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
          <div className={styles.indexHeader}>
            <h1 className={styles.postHeading} style={{ fontSize: 22, margin: 0 }}>
              Writing
            </h1>
            <span className={styles.indexCount}>
              {totalPosts} {totalPosts === 1 ? "post" : "posts"}
            </span>
          </div>
          {groups.map((group) => (
            <section key={group.label} className={styles.yearSection}>
              <h2 className={styles.yearHeading}>{group.label}</h2>
              <ul className={styles.index}>
                {group.posts.map((post) => (
                  <li key={post.slug} className={styles.indexItem}>
                    <div className={styles.indexTitle}>
                      {post.pinned && group.label !== "Pinned" && (
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
            </section>
          ))}
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
