"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { type BlogPost } from "@/content/blog/registry";
import { publishSearchStatus } from "./searchStatus";
import { CaptionIcon } from "./CaptionIcon";
import styles from "./blog.module.css";

// Client-island for the /blog index. Page shell + metadata stay on
// the server (see page.tsx); this module owns the filter input, the
// topic chips, the Details/Icons view switch, and the grouped render.
// Search tokenizes on whitespace: every token must match the title,
// summary, or a tag (AND across tokens, OR across fields), case-
// insensitively; active topic chips must ALL be present on a post.

type PostGroup = { label: string; posts: BlogPost[] };

// Document-icon text-line colors per leading tag, from the Win98
// 16-color palette. Unknown tags fall back to navy.
const TAG_ICON_COLORS: Record<string, string> = {
  engineering: "#000080",
  ai: "#008080",
  launch: "#808000",
  brand: "#800000",
  writing: "#800080",
  consulting: "#008000",
  infrastructure: "#000080",
  mdx: "#800080",
  rive: "#008000",
};

const iconColor = (post: BlogPost) =>
  TAG_ICON_COLORS[post.tags[0]] ?? "#000080";

// Pinned posts live in the featured card while nothing is filtered;
// inside a filter they come back as a plain "Pinned" group (a pinned
// result inside a search is just a result).
function groupPosts(posts: BlogPost[], filtering: boolean): PostGroup[] {
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
  return filtering && pinned.length > 0
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
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [view, setView] = useState<"details" | "icons">("details");
  const searchRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  const tokens = useMemo(
    () => (trimmed ? trimmed.toLowerCase().split(/\s+/) : []),
    [trimmed]
  );

  const filtering = tokens.length > 0 || activeTags.length > 0;

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (activeTags.length > 0 && !activeTags.every((t) => p.tags.includes(t)))
        return false;
      if (tokens.length === 0) return true;
      return matches(p, tokens);
    });
  }, [posts, tokens, activeTags]);

  const groups = useMemo(
    () => groupPosts(filtered, filtering),
    [filtered, filtering]
  );

  // Icons view is a flat Explorer grid: no year groups, newest first,
  // pinned included like any other file.
  const flatPosts = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [filtered]
  );

  // Every tag that exists on a post, busiest topics first so the chip
  // row leads with the meat.
  const allTags = useMemo(() => {
    const freq = new Map<string, number>();
    posts.forEach((p) =>
      p.tags.forEach((t) => freq.set(t, (freq.get(t) ?? 0) + 1))
    );
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([t]) => t);
  }, [posts]);

  const featured = !filtering ? posts.find((p) => p.pinned) : undefined;

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
  // the shell); publish the filter state so its cells track it.
  useEffect(() => {
    publishSearchStatus({
      active: filtering,
      matched: filtered.length,
      total: posts.length,
      topics: activeTags,
    });
    return () => publishSearchStatus(null);
  }, [filtering, filtered.length, posts.length, activeTags]);

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

  const clearFilters = () => {
    setQuery("");
    setActiveTags([]);
    // The Clear button unmounts with the query — without this,
    // keyboard focus falls to <body> and the user is dumped to the
    // top of the tab order.
    searchRef.current?.focus();
  };

  const toggleTag = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const countLabel = filtering
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
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className={styles.searchClear}
            aria-label="Clear search and topic filters"
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
        <div
          className={styles.viewToggle}
          role="group"
          aria-label="List view"
        >
          <button
            type="button"
            className={styles.viewBtn}
            aria-pressed={view === "details"}
            onClick={() => setView("details")}
            title="Details view"
          >
            Details
          </button>
          <button
            type="button"
            className={styles.viewBtn}
            aria-pressed={view === "icons"}
            onClick={() => setView("icons")}
            title="Large icons view"
          >
            Icons
          </button>
        </div>
      </search>

      <div className={styles.topicsRow} aria-label="Filter by topic">
        <span className={styles.topicsLabel}>Topics:</span>
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={styles.topicChip}
            aria-pressed={activeTags.includes(tag)}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* aria-live so screen readers announce filter changes. polite
       * so it doesn't fight ongoing speech; atomic so the post count
       * is spoken as a single update instead of letter by letter. */}
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {filtering
          ? `${filtered.length} of ${posts.length} posts match${
              trimmed ? ` "${trimmed}"` : ""
            }${activeTags.length ? ` in ${activeTags.join(", ")}` : ""}.`
          : ""}
      </div>

      {featured && (
        <Link href={`/blog/${featured.slug}`} className={styles.featured}>
          <CaptionIcon
            className={styles.featuredIcon}
            lineColor={iconColor(featured)}
          />
          <span style={{ display: "block" }}>
            <span className={styles.featuredBadge}>Start here</span>
            <span className={styles.featuredTitle}>{featured.title}</span>
            <span className={styles.featuredSummary}>{featured.summary}</span>
            <span className={styles.featuredMeta}>
              {featured.date} · {featured.readingTime} read · new to the site?
              this explains everything
            </span>
          </span>
        </Link>
      )}

      {filtered.length === 0 ? (
        <div className={styles.searchEmpty}>
          <p className={styles.indexSummary} style={{ margin: 0 }}>
            {trimmed
              ? `No posts match “${trimmed}”.`
              : "No posts match the selected topics."}
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className={styles.searchClear}
          >
            Clear filters
          </button>
        </div>
      ) : view === "icons" ? (
        <div className={styles.iconsGrid}>
          {flatPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className={styles.iconCard}
              title={post.summary}
            >
              <CaptionIcon
                className={styles.iconCardIcon}
                lineColor={iconColor(post)}
              />
              <span className={styles.iconCardTitle}>
                <Highlight text={post.title} tokens={tokens} />
              </span>
              <span className={styles.iconCardMeta}>
                {post.date} · {post.readingTime}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className={styles.yearSection}>
            <h2 className={styles.yearHeading}>{group.label}</h2>
            <ul className={styles.index}>
              {group.posts.map((post) => (
                <li key={post.slug} className={styles.indexItem}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className={styles.indexLink}
                  >
                    <CaptionIcon
                      className={styles.indexIcon}
                      lineColor={iconColor(post)}
                    />
                    <span className={styles.indexText}>
                      <span className={styles.indexTitleText}>
                        <Highlight text={post.title} tokens={tokens} />
                      </span>
                      <span className={styles.indexSummary}>
                        <Highlight text={post.summary} tokens={tokens} />
                      </span>
                      <span className={styles.indexMeta}>
                        <time dateTime={post.date}>{post.date}</time> ·{" "}
                        {post.readingTime} read ·{" "}
                        <Highlight
                          text={post.tags.join(", ")}
                          tokens={tokens}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
