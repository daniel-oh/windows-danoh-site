"use client";

import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { windowAtomFamily } from "@/state/window";
import {
  sortedPosts,
  BlogPost,
  getRelatedPosts,
  getAdjacentPosts,
} from "@/content/blog/registry";
import { ReactionBar } from "@/components/ReactionBar";
import { PostBody } from "@/content/blog/registry";
import styles from "./Blog.module.css";
import { useIsMobile } from "@/lib/useIsMobile";
import { CopyAttribution } from "@/components/CopyAttribution";
import { ExternalArrow } from "@/components/ExternalArrow";

export const BLOG_WIDTH = 700;

export function Blog({ id }: { id: string }) {
  const win = useAtomValue(windowAtomFamily(id));
  const initialSlug =
    win.program.type === "blog" ? win.program.initialSlug : undefined;
  const [selectedSlug, setSelectedSlug] = useState(
    initialSlug || sortedPosts[0]?.slug || ""
  );
  const mobile = useIsMobile();
  // Landing on a specific post (clicked in Welcome) skips the list
  // view on mobile and goes straight to reading.
  const [showingPost, setShowingPost] = useState(!!initialSlug);
  const contentRef = useRef<HTMLDivElement>(null);

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
          <div className={styles.mainContent} ref={contentRef}>
            {selectedPost ? (
              <PostView
                post={selectedPost}
                onBack={goBack}
                showBack={mobile}
                onNavigate={(slug) => {
                  setSelectedSlug(slug);
                  setShowingPost(true);
                }}
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
  onNavigate,
}: {
  post: BlogPost;
  onBack: () => void;
  showBack: boolean;
  onNavigate: (slug: string) => void;
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
        <span>{post.readingTime} read</span>
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
      <CopyAttribution
        url={`https://danoh.com/blog/${post.slug}`}
        className={styles.markdown}
      >
        <PostBody slug={post.slug} />
      </CopyAttribution>
      <p
        style={{
          fontSize: 11,
          color: "#555",
          textAlign: "center",
          margin: "18px 0 0",
          paddingTop: 12,
          borderTop: "1px solid #808080",
        }}
      >
        © {post.date.slice(0, 4)} {post.author} · danoh.com/blog/
        {post.slug}
      </p>
      <PostActions slug={post.slug} />
      <ReactionBar slug={post.slug} />
      <InOsRelated slug={post.slug} onNavigate={onNavigate} />
      <p
        style={{
          marginTop: 14,
          padding: "10px 12px",
          border: "1px solid #808080",
          background: "#dfdfdf",
          fontSize: 12,
        }}
      >
        Enjoyed this? Follow along via{" "}
        <a href="/feed.xml" style={{ color: "#000080" }}>
          RSS
        </a>
        , or say hello:{" "}
        <a href="mailto:hello@danoh.com" style={{ color: "#000080" }}>
          hello@danoh.com
        </a>
        .
      </p>
    </article>
  );
}

// In-OS readers used to dead-end after a post; the standalone pages had
// related/prev-next all along. Navigation stays inside the window.
function InOsRelated({
  slug,
  onNavigate,
}: {
  slug: string;
  onNavigate: (slug: string) => void;
}) {
  const related = getRelatedPosts(slug, 3);
  const { previous, next } = getAdjacentPosts(slug);
  if (related.length === 0 && !previous && !next) return null;
  const linkStyle = { color: "#000080", cursor: "pointer" } as const;
  return (
    <aside aria-label="Related posts" style={{ marginTop: 16, fontSize: 12 }}>
      {related.length > 0 && (
        <>
          <div style={{ fontWeight: "bold", marginBottom: 4 }}>
            More from the blog
          </div>
          <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
            {related.map((p) => (
              <li key={p.slug} style={{ margin: "2px 0" }}>
                <a
                  href={`/blog/${p.slug}`}
                  style={linkStyle}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(p.slug);
                  }}
                >
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        {previous ? (
          <a
            href={`/blog/${previous.slug}`}
            style={linkStyle}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(previous.slug);
            }}
          >
            ← {previous.title}
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a
            href={`/blog/${next.slug}`}
            style={linkStyle}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(next.slug);
            }}
          >
            {next.title} →
          </a>
        ) : (
          <span />
        )}
      </div>
    </aside>
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
      {/* button-with-onClick rather than the previous <button> nested
       * inside an <a> (interactive-inside-interactive is invalid HTML
       * and confuses some screen readers + iOS double-tap zoom). The
       * SVG arrow replaces the bare ↗ Unicode glyph, which mobile
       * fallback fonts often render as tofu (a black box). */}
      <button
        type="button"
        onClick={() =>
          window.open(`/blog/${slug}`, "_blank", "noopener,noreferrer")
        }
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        Open full page
        <ExternalArrow />
      </button>
    </div>
  );
}



