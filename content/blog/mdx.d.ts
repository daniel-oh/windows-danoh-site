declare module "*.mdx" {
  import type { ComponentType } from "react";
  import type { MDXComponents } from "mdx/types";
  import type { BlogPost } from "@/content/blog/registry";
  const MDXComponent: ComponentType<{ components?: MDXComponents }>;
  export default MDXComponent;
  // Typed as BlogPost so the registry's `satisfies` check is real —
  // a malformed meta in any post file fails the build.
  export const meta: BlogPost;
}
