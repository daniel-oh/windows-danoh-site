// Post metadata — one array of plain TS data, no React imports.
// Kept separate from the MDX component modules so that non-React code
// paths (RSS feed, sitemap, metadata helpers) can import post data
// without eagerly evaluating MDX → React.
//
// Adding a new post:
//   1. Create content/blog/posts/<slug>.mdx (markdown + MDX body).
//   2. Add an entry below.
//   3. Add an import + map entry to content/blog/posts-content.tsx.

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  summary: string;
  tags: string[];
  readingTime: string;
  pinned?: boolean;
  /** Optional hero image shown at the top of the post + used as OG preview. */
  image?: string;
  /** Intrinsic width + height of the hero image. Required when `image` is
   * set so next/image can reserve space (no layout shift) and pick the
   * right srcSet. Both must be provided together. */
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  imageCaption?: string;
};

export const posts: BlogPost[] = [
  {
    slug: "two-sites-one-operator",
    title: "Two sites, one operator",
    date: "2026-05-11",
    author: "Daniel Oh",
    summary:
      "I shipped a second site this month. floeberg.com, a different voice and a narrower lane, for the consulting work this place was never going to do. Notes on the brand split, the wedge, and the hand-off between the two.",
    tags: ["brand", "writing", "consulting", "ai"],
    readingTime: "4 min",
  },
  {
    slug: "building-floeberg",
    title: "Building Floeberg",
    date: "2026-05-11",
    author: "Daniel Oh",
    summary:
      "Build log for floeberg.com: self-hosted gotrue on a shared Postgres, an idempotent Stripe → DB → Discord pipeline, and a single chat table projected to two surfaces. The site itself should be a depth-layer build, not duct tape.",
    tags: ["engineering", "infrastructure", "ai", "consulting"],
    readingTime: "5 min",
  },
  {
    slug: "mdx-rive-demo",
    title: "Rive in MDX: live React components in a blog post",
    date: "2026-04-17",
    author: "Daniel Oh",
    summary:
      "Proof of the MDX pipeline: a Rive animation running inside a blog post as a real React component.",
    tags: ["engineering", "mdx", "rive"],
    readingTime: "3 min",
  },
  {
    slug: "welcome-to-danoh",
    title: "Welcome to danoh.com",
    date: "2026-04-09",
    author: "Daniel Oh",
    summary:
      "Introducing danoh.com: an AI-powered retro OS that generates apps on the fly.",
    tags: ["announcement", "launch"],
    readingTime: "2 min",
  },
  {
    slug: "ai-app-generation",
    title: "How AI App Generation Works",
    date: "2026-04-10",
    author: "Daniel Oh",
    summary:
      "A look under the hood at how danoh.com generates applications from text descriptions.",
    tags: ["engineering", "ai"],
    readingTime: "3 min",
  },
];

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
  const unpinned = sortedPosts.filter((p) => !p.pinned);
  const idx = unpinned.findIndex((p) => p.slug === slug);
  if (idx === -1) return { previous: null, next: null };
  return {
    next: idx > 0 ? unpinned[idx - 1] : null,
    previous: idx < unpinned.length - 1 ? unpinned[idx + 1] : null,
  };
}
