import type { Metadata } from "next";

// Standard metadata builder for static pages. Solves the four-pages-
// repeating-the-same-pattern problem: every meta page (/blog, /privacy,
// /logout, /error) was hoisting TITLE / DESCRIPTION / URL consts and
// mirroring them across `metadata`, `openGraph`, and `twitter` blocks.
// One helper means the three blocks can never drift, and the OG +
// Twitter coverage promise (no inherited-from-homepage values) is
// enforced by construction.
//
// Per-post blog metadata (which adds article-type fields, per-post
// images, tags, publishedTime) lives in app/blog/[slug]/page.tsx's
// generateMetadata — that one needs the extra surface and stays
// hand-written.

export function buildMetadata({
  title,
  description,
  url,
  noindex = false,
}: {
  title: string;
  description: string;
  /** Canonical URL, e.g. "https://danoh.com/privacy". */
  url: string;
  /** When true, robots is set to noindex/nofollow and `canonical` is
   * dropped (you don't canonicalize a page you're telling crawlers to
   * skip). OG/Twitter are still emitted so a manually-shared link
   * still renders the correct card. */
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: noindex ? undefined : { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      // Next.js replaces (not merges) the parent openGraph block, so
      // without an explicit image these pages would ship imageless
      // cards while still declaring summary_large_image below.
      images: [
        { url: "/og-image.png", width: 1200, height: 630, alt: "Daniel Oh" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}
