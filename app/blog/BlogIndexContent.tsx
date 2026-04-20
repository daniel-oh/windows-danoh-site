"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { type BlogPost } from "@/content/blog/posts";
import styles from "./blog.module.css";

// Client-island for the /blog index. Page shell + metadata stay on
// the server (see page.tsx); this module owns just the filter input
// and the grouped render. Search matches title + summary + tags
// case-insensitively. Empty filter = normal grouped view.

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

function matches(post: BlogPost, query: string): boolean {
  const q = query.toLowerCase();
  if (post.title.toLowerCase().includes(q)) return true;
  if (post.summary.toLowerCase().includes(q)) return true;
  if (post.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}

export function BlogIndexContent({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const filtered = useMemo(() => {
    if (!trimmed) return posts;
    return posts.filter((p) => matches(p, trimmed));
  }, [posts, trimmed]);

  const groups = useMemo(() => groupPosts(filtered), [filtered]);
  const totalPosts = filtered.length;

  return (
    <>
      <div className={styles.indexHeader}>
        <h1 className={styles.postHeading} style={{ fontSize: 22, margin: 0 }}>
          Writing
        </h1>
        <span className={styles.indexCount}>
          {totalPosts} {totalPosts === 1 ? "post" : "posts"}
        </span>
      </div>

      <div className={styles.searchRow}>
        <label htmlFor="blog-search" className={styles.searchLabel}>
          Search
        </label>
        <input
          id="blog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title, summary, or tag"
          className={styles.searchInput}
          aria-label="Filter posts"
        />
        {trimmed && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className={styles.searchClear}
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className={styles.indexSummary} style={{ marginTop: 14 }}>
          No posts match &ldquo;{trimmed}&rdquo;.
        </p>
      ) : (
        groups.map((group) => (
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
        ))
      )}
    </>
  );
}
