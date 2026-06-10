"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type BlogPost } from "@/content/blog/registry";
import { publishSearchStatus } from "./searchStatus";
import styles from "./blog.module.css";

// Client-island for the /blog index. Page shell + metadata stay on
// the server (see page.tsx); this module owns the filter input and
// the grouped render. Search tokenizes on whitespace: every token
// must match the title, summary, or a tag (AND across tokens, OR
// across fields), case-insensitively. Empty filter = grouped view.

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

function matches(post: BlogPost, tokens: string[]): boolean {
  const haystacks = [
    post.title.toLowerCase(),
    post.summary.toLowerCase(),
    ...post.tags.map((t) => t.toLowerCase()),
  ];
  return tokens.every((tok) => haystacks.some((h) => h.includes(tok)));
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wraps every token occurrence in <mark> so a result shows WHY it
 * matched. The capture group makes split() keep matched text at every
 * odd index. */
function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (tokens.length === 0) return <>{text}</>;
  const re = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(re);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={styles.searchMark}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function BlogIndexContent({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  const tokens = useMemo(
    () => (trimmed ? trimmed.toLowerCase().split(/\s+/) : []),
    [trimmed]
  );

  const filtered = useMemo(() => {
    if (tokens.length === 0) return posts;
    return posts.filter((p) => matches(p, tokens));
  }, [posts, tokens]);

  const groups = useMemo(() => groupPosts(filtered), [filtered]);

  // ?q= makes a filtered view shareable and survive back-navigation.
  // Init happens post-mount because the server rendered the UNfiltered
  // list — reading location in the useState initializer would make the
  // first client render disagree with the server HTML. One-time sync
  // FROM an external system (the URL) is the carve-out the lint rule
  // can't see; there's nothing to subscribe to for a parse-once read.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setQuery(q);
  }, []);

  // Reflect the query in the URL. replaceState, not pushState: typing
  // shouldn't bury the previous page under one history entry per
  // keystroke. The first run is skipped so the empty mount doesn't
  // strip a ?q= the init effect above is about to read.
  const skippedFirstWrite = useRef(false);
  useEffect(() => {
    if (!skippedFirstWrite.current) {
      skippedFirstWrite.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if (trimmed) url.searchParams.set("q", trimmed);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [trimmed]);

  // The status bar lives outside this island (page.tsx renders it in
  // the shell); publish the count so it tracks the filter.
  useEffect(() => {
    publishSearchStatus(
      trimmed
        ? { active: true, matched: filtered.length, total: posts.length }
        : null
    );
    return () => publishSearchStatus(null);
  }, [trimmed, filtered.length, posts.length]);

  // `/` focuses search from anywhere on the page, unless the user is
  // already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clearSearch = () => {
    setQuery("");
    // The Clear button unmounts with the query — without this,
    // keyboard focus falls to <body> and the user is dumped to the
    // top of the tab order.
    searchRef.current?.focus();
  };

  const countLabel = trimmed
    ? `${filtered.length} of ${posts.length} posts`
    : `${posts.length} ${posts.length === 1 ? "post" : "posts"}`;

  return (
    <>
      <div className={styles.indexHeader}>
        <h1 className={styles.postHeading} style={{ fontSize: 22, margin: 0 }}>
          Writing
        </h1>
        <span className={styles.indexCount}>{countLabel}</span>
      </div>

      <search className={styles.searchRow}>
        <label htmlFor="blog-search" className={styles.searchLabel}>
          Search
        </label>
        <input
          ref={searchRef}
          id="blog-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Chrome clears type=search on Escape natively; Firefox
            // doesn't. Handling it here makes the behavior uniform and
            // keeps the controlled value in sync.
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
          placeholder="Filter by title, summary, or tag"
          className={styles.searchInput}
        />
        {trimmed && (
          <button
            type="button"
            onClick={clearSearch}
            className={styles.searchClear}
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
        {/* Sighted-keyboard affordance only: hidden on touch (no key
         * to press) and from the accessibility tree (the label already
         * names the control). */}
        <kbd
          className={styles.searchKbd}
          aria-hidden="true"
          title="Press / to search"
        >
          /
        </kbd>
      </search>

      {/* aria-live so screen readers announce filter changes. polite
       * so it doesn't fight ongoing speech; atomic so the post count
       * is spoken as a single update instead of letter by letter. */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {trimmed
          ? `${filtered.length} of ${posts.length} posts match "${trimmed}".`
          : ""}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.searchEmpty}>
          <p className={styles.indexSummary} style={{ margin: 0 }}>
            No posts match &ldquo;{trimmed}&rdquo;.
          </p>
          <button
            type="button"
            onClick={clearSearch}
            className={styles.searchClear}
          >
            Clear search
          </button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className={styles.yearSection}>
            <h2 className={styles.yearHeading}>{group.label}</h2>
            <ul className={styles.index}>
              {group.posts.map((post) => {
                const tagHits =
                  tokens.length > 0
                    ? post.tags.filter((t) =>
                        tokens.some((tok) => t.toLowerCase().includes(tok))
                      )
                    : [];
                return (
                  <li key={post.slug} className={styles.indexItem}>
                    <div className={styles.indexTitle}>
                      {post.pinned && group.label !== "Pinned" && (
                        <span className={styles.pinnedBadge}>Pinned</span>
                      )}
                      <Link
                        href={`/blog/${post.slug}`}
                        className={styles.indexTitleLink}
                      >
                        <Highlight text={post.title} tokens={tokens} />
                      </Link>
                    </div>
                    <p className={styles.indexSummary}>
                      <Highlight text={post.summary} tokens={tokens} />
                    </p>
                    <div className={styles.indexMeta}>
                      <time dateTime={post.date}>{post.date}</time> ·{" "}
                      {post.author} · {post.readingTime} read
                      {tagHits.length > 0 && (
                        <>
                          {" · tagged "}
                          <Highlight
                            text={tagHits.join(", ")}
                            tokens={tokens}
                          />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
