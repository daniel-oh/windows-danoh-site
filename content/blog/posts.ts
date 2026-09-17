// Post METADATA only: titles, dates, summaries, tags. No post bodies.
//
// Welcome and StaticIntro are on the home page's critical path and only
// need a list of titles. They used to import registry.tsx, which
// statically imports every compiled MDX body plus SitePreview and Rive, so
// every post ever written shipped in the JavaScript for "/". Anything that
// only lists posts imports from here; anything that RENDERS a post body
// imports registry.tsx (which re-exports this module).
//
// posts.generated.ts is written by scripts/check-posts.mjs from each
// post's own `export const meta`, so the MDX file stays the single source
// of truth. Importing `meta` from the .mdx directly is not an option: that
// evaluates the whole module, body included.
import type { BlogPost } from "./types";
import { posts as generated } from "./posts.generated";

export type { BlogPost };

export const posts: BlogPost[] = generated;

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
  // Pure chronology, ignoring the pin: pinning is an index-page
  // presentation choice, but excluding pinned posts here left them with
  // no prev/next at all and punched a hole in every neighbor's chain.
  const byDate = [...sortedPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const idx = byDate.findIndex((p) => p.slug === slug);
  if (idx === -1) return { previous: null, next: null };
  return {
    next: idx > 0 ? byDate[idx - 1] : null,
    previous: idx < byDate.length - 1 ? byDate[idx + 1] : null,
  };
}
