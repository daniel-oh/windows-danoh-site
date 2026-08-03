// The single source of truth for blog content. Each post's metadata
// lives INSIDE its MDX file (`export const meta`) where it cannot
// drift from the body; this registry pairs each meta with its compiled
// component so every consumer — /blog pages, the in-OS Blog program,
// feed.xml, sitemap, Welcome, StaticIntro — imports from one place.
//
// Adding a post:
//   1. Create content/blog/posts/<slug>.mdx with an `export const meta`.
//   2. Add ONE import + entry pair below.
// scripts/check-posts.mjs (wired as prebuild) fails the build if the
// files on disk and the entries here ever disagree.

import type { ComponentType } from "react";
import type { MDXComponents } from "mdx/types";

import Feels, { meta as feels } from "./posts/one-day-128-feelings.mdx";
import Eleven, { meta as eleven } from "./posts/eleven-sites-one-operator.mdx";
import Fable5, { meta as fable5 } from "./posts/letting-fable-5-loose.mdx";
import TwoSites, { meta as twoSites } from "./posts/two-sites-one-operator.mdx";
import Floeberg, { meta as floeberg } from "./posts/building-floeberg.mdx";
import RiveDemo, { meta as riveDemo } from "./posts/mdx-rive-demo.mdx";
import Welcome, { meta as welcome } from "./posts/welcome-to-danoh.mdx";
import AiAppGen, { meta as aiAppGen } from "./posts/ai-app-generation.mdx";

export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  summary: string;
  tags: string[];
  readingTime: string;
  pinned?: boolean;
  /** Optional hero image shown at the top of the post. Share/OG cards
   * are generated per post by app/blog/[slug]/opengraph-image.tsx and
   * ignore this field. */
  image?: string;
  /** Intrinsic width + height of the hero image. Required when `image` is
   * set so next/image can reserve space (no layout shift) and pick the
   * right srcSet. Both must be provided together. */
  imageWidth?: number;
  imageHeight?: number;
  imageAlt?: string;
  imageCaption?: string;
};

type MDXContent = ComponentType<{ components?: MDXComponents }>;

// `satisfies` typo-proofs every meta against the BlogPost shape at
// compile time — a missing field in an MDX meta fails tsc, not prod.
const entries = [
  [feels, Feels],
  [eleven, Eleven],
  [fable5, Fable5],
  [twoSites, TwoSites],
  [floeberg, Floeberg],
  [riveDemo, RiveDemo],
  [welcome, Welcome],
  [aiAppGen, AiAppGen],
] as const satisfies readonly (readonly [BlogPost, MDXContent])[];

export const posts: BlogPost[] = entries.map(([m]) => m);

// Pinned posts float to the top. Within each group (pinned / unpinned)
// posts are ordered newest-first by date.
export const sortedPosts = [...posts].sort((a, b) => {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return new Date(b.date).getTime() - new Date(a.date).getTime();
});

const bySlug = new Map<string, MDXContent>(
  entries.map(([m, C]) => [m.slug, C])
);

export function getPostComponent(slug: string): MDXContent | null {
  return bySlug.get(slug) ?? null;
}

/** The one shared post-body renderer (was duplicated verbatim in the
 * route page and the in-OS Blog program). */
export function PostBody({ slug }: { slug: string }) {
  // getPostComponent LOOKS UP a statically-defined MDX component from
  // a module-level map — identity is stable per slug, so this is not
  // the create-components-during-render hazard the rule targets.
  const Component = getPostComponent(slug);
  if (!Component) return <p>Post content not found.</p>;
  // eslint-disable-next-line react-hooks/static-components
  return <Component />;
}

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
