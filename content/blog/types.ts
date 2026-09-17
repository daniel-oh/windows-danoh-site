// Shape of a post's `export const meta`. Lives on its own so the light
// metadata module (posts.ts) and the heavy component registry
// (registry.tsx) can both use it without importing each other.
export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  summary: string;
  tags: string[];
  readingTime: string;
  /** Set after a substantive edit; surfaces as JSON-LD dateModified so
   * search engines see updates. Falls back to `date`. */
  updated?: string;
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
