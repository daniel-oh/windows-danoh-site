import { createElement } from "react";
import { sortedPosts } from "@/content/blog/registry";
import { getPostComponent } from "@/content/blog/registry";

const SITE = "https://danoh.com";
const TITLE = "Daniel Oh · Blog";
const DESCRIPTION =
  "Engineer who designs. Operator who writes. Notes on AI, craft, and the work of building things that last.";

// Minimal XML escape for text nodes. Blog content escapes entities inside
// CDATA anyway; this covers titles, summaries, author names, URLs.
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Full post HTML for content:encoded. Summary-only feeds weaken
// syndication and LLM-crawler ingestion (which can't read the SPA
// either). MDX components server-render fine (client components still
// produce initial HTML); any per-post render failure falls back to the
// summary rather than breaking the feed.
type RenderFn = (el: React.ReactElement) => string;

// Dynamic import: Turbopack rejects a static react-dom/server import in
// route files, but resolving it at request time in the Node runtime is
// fine — this is the standard app-router RSS workaround.
async function getRenderer(): Promise<RenderFn | null> {
  try {
    const mod = await import("react-dom/server");
    return mod.renderToStaticMarkup;
  } catch {
    return null;
  }
}

function renderPostHtml(render: RenderFn | null, slug: string): string | null {
  if (!render) return null;
  try {
    const Component = getPostComponent(slug);
    if (!Component) return null;
    return render(createElement(Component));
  } catch (err) {
    console.warn("[feed] failed to render", slug, err);
    return null;
  }
}

// "]]>" inside content would terminate the CDATA section early.
function cdata(s: string): string {
  return `<![CDATA[${s.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function rfc822(date: string): string {
  const d = new Date(date);
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

export async function GET() {
  const render = await getRenderer();
  // The registry's sortedPosts floats pinned posts first for the UI, so
  // sortedPosts[0] can be an old pinned post. A feed must be strictly
  // newest-first — both for the item order and lastBuildDate — or
  // readers show it as stale. Build a date-descending copy just for here.
  const feedPosts = [...sortedPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latest = feedPosts[0];
  const lastBuildDate = rfc822(latest?.date ?? new Date().toISOString());

  const items = feedPosts
    .map((post) => {
      const url = `${SITE}/blog/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <dc:creator>${escapeXml(post.author)}</dc:creator>
      <description><![CDATA[${post.summary}]]></description>
${(() => {
        const html = renderPostHtml(render, post.slug);
        return html ? `      <content:encoded>${cdata(html)}</content:encoded>\n` : "";
      })()}${post.tags.map((t) => `      <category>${escapeXml(t)}</category>`).join("\n")}
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(TITLE)}</title>
    <link>${SITE}/blog</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=600",
    },
  });
}
