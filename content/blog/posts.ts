import matter from "gray-matter";

// Per-file posts. Adding a new post:
//   1. Create content/blog/posts/<slug>.md with YAML frontmatter.
//   2. Add one import line + entry to RAW_POSTS below.
// The .md files are pulled in as raw strings via a webpack asset rule
// (see next.config.mjs) so the same bundle works in server + client.

import welcomeToDanoh from "./posts/welcome-to-danoh.md";
import aiAppGeneration from "./posts/ai-app-generation.md";

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  summary: string;
  tags: string[];
  content: string;
  /** Set true to surface this post at the top of the Blog regardless of date. */
  pinned?: boolean;
  /** Optional hero image shown at the top of the post + used as OG preview. */
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
};

type RawPost = { slug: string; raw: string };

const RAW_POSTS: RawPost[] = [
  { slug: "welcome-to-danoh", raw: welcomeToDanoh },
  { slug: "ai-app-generation", raw: aiAppGeneration },
];

function toIsoDate(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return "";
}

function parsePost({ slug, raw }: RawPost): BlogPost {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  return {
    slug,
    title: String(data.title ?? slug),
    date: toIsoDate(data.date),
    author: String(data.author ?? "Daniel Oh"),
    summary: String(data.summary ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content: parsed.content.trim(),
    pinned: data.pinned === true,
    image: typeof data.image === "string" ? data.image : undefined,
    imageAlt: typeof data.imageAlt === "string" ? data.imageAlt : undefined,
    imageCaption:
      typeof data.imageCaption === "string" ? data.imageCaption : undefined,
  };
}

export const posts: BlogPost[] = RAW_POSTS.map(parsePost);

// Pinned posts float to the top. Within each group (pinned / unpinned)
// posts are ordered newest-first by date.
export const sortedPosts = [...posts].sort((a, b) => {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.date).getTime() - new Date(a.date).getTime();
});

// --- Related / adjacent helpers -------------------------------------
export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const current = sortedPosts.find((p) => p.slug === slug);
  if (!current) return [];
  return sortedPosts
    .filter((p) => p.slug !== slug)
    .map((p) => ({
      post: p,
      score: p.tags.filter((t) => current.tags.includes(t)).length,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.post.date).getTime() - new Date(a.post.date).getTime();
    })
    .slice(0, limit)
    .map((r) => r.post);
}

export function getAdjacentPosts(
  slug: string
): { previous: BlogPost | null; next: BlogPost | null } {
  // "previous" = older (earlier in sortedPosts because sortedPosts is
  // newest-first, older posts come later). "next" = newer.
  const unpinned = sortedPosts.filter((p) => !p.pinned);
  const idx = unpinned.findIndex((p) => p.slug === slug);
  if (idx === -1) return { previous: null, next: null };
  return {
    next: idx > 0 ? unpinned[idx - 1] : null,
    previous: idx < unpinned.length - 1 ? unpinned[idx + 1] : null,
  };
}
