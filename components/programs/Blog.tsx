"use client";

import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import { sortedPosts, BlogPost } from "@/content/blog/posts";
import styles from "./Blog.module.css";
import { isMobile } from "@/lib/isMobile";

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

  useEffect(() => {
    setMobile(isMobile());
  }, []);

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
                    <div className={styles.postTitle}>{post.title}</div>
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
          <div className={styles.mainContent} role="main">
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
      <div className={styles.markdown}>
        <Markdown
          components={{
            img: ({ src, alt }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || ""}
                className={styles.postImage}
                loading="lazy"
              />
            ),
          }}
        >
          {post.content}
        </Markdown>
      </div>
    </article>
  );
}
