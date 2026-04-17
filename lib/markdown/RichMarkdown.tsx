"use client";

import Markdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";

// Single markdown renderer used by both the in-OS Blog and the SSR
// /blog/[slug] pages so the formatting stays in sync.
//
// Plugins:
// - remark-gfm:        tables, footnotes, task lists, strikethrough, autolinks
// - rehype-raw:        lets posts embed raw HTML (<video>, <iframe>, <figure>).
//                      Posts are authored by the repo owner, so the usual
//                      untrusted-html risk doesn't apply.
// - rehype-highlight:  server-side syntax coloring for ```lang code blocks

function isExternal(href: string | undefined): boolean {
  if (!href) return false;
  return /^(https?:)?\/\//.test(href) && !href.startsWith("/");
}

const components: Components = {
  // External links open in a new tab; internal links stay in-page.
  a({ href, children, ...rest }) {
    const external = isExternal(href);
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        {...rest}
      >
        {children}
      </a>
    );
  },
  // Images render as semantic <figure>/<figcaption>. If the markdown uses
  // ![alt](src "caption") the caption goes under the image; otherwise the
  // alt text is used as the caption.
  img({ src, alt, title }) {
    if (!src) return null;
    const caption = title || alt || "";
    // eslint-disable-next-line @next/next/no-img-element
    const img = <img src={typeof src === "string" ? src : undefined} alt={alt || ""} loading="lazy" />;
    if (!caption) return img;
    return (
      <figure>
        {img}
        <figcaption>{caption}</figcaption>
      </figure>
    );
  },
};

export function RichMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeHighlight, { ignoreMissing: true }]]}
      components={components}
    >
      {children}
    </Markdown>
  );
}
