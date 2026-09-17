// The single source of truth for blog content. Each post's metadata
// lives INSIDE its MDX file (`export const meta`) where it cannot
// drift from the body; this registry pairs each meta with its compiled
// component for the consumers that render post bodies: /blog/[slug], the
// in-OS Blog program, feed.xml.
//
// HEAVY: importing this file pulls in every compiled post. Code that only
// lists posts (Welcome, StaticIntro, sitemap, the index) imports
// ./posts instead, which this file re-exports for convenience.
//
// Adding a post:
//   1. Create content/blog/posts/<slug>.mdx with an `export const meta`.
//   2. Add ONE import + entry pair below.
// scripts/check-posts.mjs (wired as prebuild) fails the build if the
// files on disk and the entries here ever disagree.

import type { ComponentType } from "react";
import type { MDXComponents } from "mdx/types";
// Syntax colors travel with the post bodies: this module is the only thing
// that renders them (the /blog/[slug] page and the in-OS Blog program both
// go through PostBody), so the stylesheet loads exactly where code blocks
// can appear. It used to be imported by the root layout, which made it
// render-blocking CSS on the home page, /resume and /privacy for nothing.
//
// github-dark, not github — our blog code blocks use a near-black
// background (#1a1a1a) in both the in-OS Blog window and the standalone
// /blog/[slug] page. The light github theme ships dark token colors,
// so on our dark background everything reads as black-on-black. The
// dark theme's tokens are engineered for this exact contrast.
import "highlight.js/styles/github-dark.css";
import type { BlogPost } from "./types";
import { SitePreview } from "@/components/mdx/SitePreview";
import { Rive } from "@/components/mdx/Rive";
import { Reel } from "@/components/mdx/Reel";

import Cutout, { meta as cutout } from "./posts/background-remover.mdx";
import Pivots, { meta as pivots } from "./posts/three-pivots-and-a-lowercase-k.mdx";
import Feels, { meta as feels } from "./posts/one-day-128-feelings.mdx";
import Eleven, { meta as eleven } from "./posts/eleven-sites-one-operator.mdx";
import Fable5, { meta as fable5 } from "./posts/letting-fable-5-loose.mdx";
import TwoSites, { meta as twoSites } from "./posts/two-sites-one-operator.mdx";
import Floeberg, { meta as floeberg } from "./posts/building-floeberg.mdx";
import RiveDemo, { meta as riveDemo } from "./posts/mdx-rive-demo.mdx";
import Welcome, { meta as welcome } from "./posts/welcome-to-danoh.mdx";
import AiAppGen, { meta as aiAppGen } from "./posts/ai-app-generation.mdx";


type MDXContent = ComponentType<{ components?: MDXComponents }>;

// `satisfies` typo-proofs every meta against the BlogPost shape at
// compile time — a missing field in an MDX meta fails tsc, not prod.
const entries = [
  [cutout, Cutout],
  [pivots, Pivots],
  [feels, Feels],
  [eleven, Eleven],
  [fable5, Fable5],
  [twoSites, TwoSites],
  [floeberg, Floeberg],
  [riveDemo, RiveDemo],
  [welcome, Welcome],
  [aiAppGen, AiAppGen],
] as const satisfies readonly (readonly [BlogPost, MDXContent])[];


const bySlug = new Map<string, MDXContent>(
  entries.map(([m, C]) => [m.slug, C])
);

export function getPostComponent(slug: string): MDXContent | null {
  return bySlug.get(slug) ?? null;
}

/** Rich embeds available to every post as bare JSX tags (`<SitePreview>`,
 * `<Rive>`, `<Reel>`) with NO import line in the .mdx. Posts must not import these
 * directly: an explicit import can't be overridden by the `components`
 * prop, and both are client-only (next/image, next/dynamic), which
 * throws under the feed's renderToStaticMarkup. feed.xml passes its own
 * server-safe stand-ins for the same names. */
export const postComponents: MDXComponents = { SitePreview, Rive, Reel };

/** The one shared post-body renderer (was duplicated verbatim in the
 * route page and the in-OS Blog program). */
export function PostBody({ slug }: { slug: string }) {
  // getPostComponent LOOKS UP a statically-defined MDX component from
  // a module-level map — identity is stable per slug, so this is not
  // the create-components-during-render hazard the rule targets.
  const Component = getPostComponent(slug);
  if (!Component) return <p>Post content not found.</p>;
  // eslint-disable-next-line react-hooks/static-components
  return <Component components={postComponents} />;
}

// Metadata + list helpers live in the light module; re-exported so
// existing `from "@/content/blog/registry"` imports keep working.
export * from "./posts";
