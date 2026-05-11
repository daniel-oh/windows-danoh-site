// Slug → compiled MDX component map. Separated from posts.ts so that
// non-React consumers (feed.xml, sitemap) can read metadata without
// dragging in React via MDX modules.
//
// Authors should pass the `components` prop when they want to override
// default MDX element mappings or inject custom components like Rive:
//   <Component components={{ Rive }} />

import type { ComponentType } from "react";
import type { MDXComponents } from "mdx/types";

import WelcomePost from "./posts/welcome-to-danoh.mdx";
import AiAppGenPost from "./posts/ai-app-generation.mdx";
import MdxRiveDemoPost from "./posts/mdx-rive-demo.mdx";
import BuildingFloebergPost from "./posts/building-floeberg.mdx";

type MDXContent = ComponentType<{ components?: MDXComponents }>;

const POST_COMPONENTS: Record<string, MDXContent> = {
  "welcome-to-danoh": WelcomePost,
  "ai-app-generation": AiAppGenPost,
  "mdx-rive-demo": MdxRiveDemoPost,
  "building-floeberg": BuildingFloebergPost,
};

export function getPostComponent(slug: string): MDXContent | null {
  return POST_COMPONENTS[slug] ?? null;
}
