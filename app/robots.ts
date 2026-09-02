import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/"],
    },
    // No `host`: it's a Yandex-only directive (and expects a bare
    // hostname anyway); Google/Bing ignore it.
    sitemap: "https://danoh.com/sitemap.xml",
  };
}
