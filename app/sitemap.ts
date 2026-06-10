import type { MetadataRoute } from "next";
import { sortedPosts } from "@/content/blog/posts";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://danoh.com";
  // Honest lastmod, not request time: Google ignores lastmod site-wide
  // once it detects fabricated values, which would hurt recrawl of the
  // posts that DO carry accurate dates. The homepage and index move
  // when content does — the newest post date is the truthful proxy.
  const latestPost = sortedPosts.reduce(
    (max, p) => (p.date > max ? p.date : max),
    sortedPosts[0]?.date ?? "2026-01-01"
  );
  const PRIVACY_LAST_EDITED = "2026-05-12";

  const entries: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(latestPost),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/blog`,
      lastModified: new Date(latestPost),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/privacy`,
      lastModified: new Date(PRIVACY_LAST_EDITED),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  for (const post of sortedPosts) {
    entries.push({
      url: `${base}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly",
      priority: post.pinned ? 0.8 : 0.6,
    });
  }

  return entries;
}
