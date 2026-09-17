// BreadcrumbList structured data: what lets Google show
// "danoh.com › Blog › Post title" above a result instead of a raw URL.
//
// One component so every page describes its trail the same way. Only
// posts had breadcrumbs before, each page hand-rolling its own JSON-LD.
// The last crumb is the current page and carries no `item` URL, which is
// the shape Google documents.

const SITE = "https://danoh.com";

export type Crumb = { name: string; path?: string };

export function BreadcrumbLd({ trail }: { trail: Crumb[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...trail].map((c, i, all) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(i < all.length - 1 && c.path !== undefined
        ? { item: c.path === "/" ? SITE : `${SITE}${c.path}` }
        : {}),
    })),
  };
  return (
    <script
      type="application/ld+json"
      // "<" is escaped so a title can never close the script element.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
      }}
    />
  );
}
