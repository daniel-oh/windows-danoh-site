"use client";

import { useEffect, useRef, useState } from "react";
import { sortedPosts, BlogPost } from "@/content/blog/posts";
import styles from "./Blog.module.css";
import { isMobile } from "@/lib/isMobile";
import { REACTIONS, useReactions } from "@/lib/useReactions";
import { RichMarkdown } from "@/lib/markdown/RichMarkdown";

export const BLOG_WIDTH = 700;

function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function Blog({ id: _id }: { id: string }) {
  const [selectedSlug, setSelectedSlug] = useState(
    sortedPosts[0]?.slug || ""
  );
  const [mobile, setMobile] = useState(false);
  const [showingPost, setShowingPost] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobile(isMobile());
  }, []);

  // Scroll back to the top when the selected post changes.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [selectedSlug]);

  const selectedPost = sortedPosts.find((p) => p.slug === selectedSlug);

  const selectPost = (slug: string) => {
    setSelectedSlug(slug);
    if (mobile) setShowingPost(true);
  };

  const goBack = () => {
    setShowingPost(false);
  };

  // On desktop: always show both sidebar and content
  // On mobile: toggle between post list and post content
  const showSidebar = !mobile || !showingPost;
  const showContent = !mobile || showingPost;

  return (
    <div className={styles.blogContainer}>
      <header className={styles.taglineHeader}>
        <div className={styles.taglineLine1}>
          Engineer who designs. Operator who writes.
        </div>
        <div className={styles.taglineLine2}>
          AI, craft, and the work of building things that last.
        </div>
      </header>
      <div className={styles.contentWrapper}>
        {showSidebar && (
          <nav className={styles.sidebar} role="navigation" aria-label="Blog posts">
            <div className={styles.sidebarTitle}>Posts</div>
            <ul className={styles.postList}>
              {sortedPosts.map((post) => (
                <li
                  key={post.slug}
                  className={
                    selectedSlug === post.slug ? styles.selectedPost : ""
                  }
                  aria-current={selectedSlug === post.slug ? "true" : undefined}
                >
                  <button
                    className={styles.postListButton}
                    aria-label={`Read post: ${post.title}`}
                    onClick={() => selectPost(post.slug)}
                  >
                    <div className={styles.postTitle}>
                      {post.pinned && (
                        <span
                          aria-label="Pinned"
                          title="Pinned"
                          style={{ marginRight: 4 }}
                        >
                          📌
                        </span>
                      )}
                      {post.title}
                    </div>
                    <div className={styles.postDate}>
                      {post.date} &middot; {post.author}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {showContent && (
          <div className={styles.mainContent} role="main" ref={contentRef}>
            {selectedPost ? (
              <PostView
                post={selectedPost}
                onBack={goBack}
                showBack={mobile}
              />
            ) : (
              <p>Select a post from the list.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PostView({
  post,
  onBack,
  showBack,
}: {
  post: BlogPost;
  onBack: () => void;
  showBack: boolean;
}) {
  return (
    <article role="article">
      {showBack && (
        <button className={styles.backButton} onClick={onBack} aria-label="Back to all posts">
          &larr; All Posts
        </button>
      )}
      <h2 className={styles.postHeading}>{post.title}</h2>
      <div className={styles.postMeta}>
        <span>{post.author}</span>
        <span>&middot;</span>
        <span>{post.date}</span>
        <span>&middot;</span>
        <span>{readingTime(post.content)}</span>
      </div>
      {post.tags.length > 0 && (
        <div className={styles.tags}>
          {post.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      {post.image && (
        <figure className={styles.hero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image}
            alt={post.imageAlt || post.title}
            className={styles.postImage}
            loading="eager"
          />
          {post.imageCaption && (
            <figcaption className={styles.heroCaption}>
              {post.imageCaption}
            </figcaption>
          )}
        </figure>
      )}
      <div className={styles.markdown}>
        <RichMarkdown>{post.content}</RichMarkdown>
      </div>
      <PostActions slug={post.slug} />
      <ReactionBar slug={post.slug} />
    </article>
  );
}

function PostActions({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const url = `https://danoh.com/blog/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers: manual fallback
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); } catch { /* give up */ }
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div
      style={{
        marginTop: 18,
        display: "flex",
        gap: 8,
        justifyContent: "flex-end",
      }}
    >
      <button type="button" onClick={onCopy}>
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        href={`/blog/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <button type="button">Open full page ↗</button>
      </a>
    </div>
  );
}

function ReactionBar({ slug }: { slug: string }) {
  const { counts, mine, toggle } = useReactions(slug);
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 12,
        borderTop: "1px solid #808080",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, color: "#555" }}>
        How did this land?
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {REACTIONS.map((r) => {
          const active = mine.includes(r.key);
          const count = counts[r.key] ?? 0;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={active}
              aria-label={`${r.label} this post`}
              onClick={() => toggle(r.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                minHeight: 40,
                fontSize: 14,
                fontWeight: active ? 700 : 400,
              }}
            >
              <span style={{ fontSize: 17 }}>{r.emoji}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
