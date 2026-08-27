"use client";

import { useEffect, useRef, useState } from "react";

// Wrap any content block to append a "Read more at danoh.com/…"
// citation when a visitor copies a non-trivial selection out of it.
//
// Behavior:
//   - Only fires for selections >= MIN_CHARS so word-level copies
//     (lookups, share-quotes-of-2-words) aren't polluted with a footer.
//   - Sets both text/plain and text/html, so a paste into a doc with
//     rich formatting gets a real <a>; a paste into chat gets the
//     bare URL as a new line.
//   - Walks the original selection's HTML rather than re-stringifying
//     plain text, so any links / formatting the visitor selected
//     survive the copy.
//   - data-no-copy-attribution on any ancestor opts that subtree out
//     (use on <pre> blocks where the visitor is grabbing code).

const MIN_CHARS = 40;

export function CopyAttribution({
  url,
  children,
  className,
}: {
  /** Canonical URL to cite. Full https://danoh.com/… */
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const handler = (e: ClipboardEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

      const text = sel.toString();
      if (text.length < MIN_CHARS) return;

      const range = sel.getRangeAt(0);
      const anchor = range.commonAncestorContainer;
      if (!host.contains(anchor)) return;

      // Skip code copies — devs grabbing a snippet want the snippet,
      // not a citation footer in their pasted shell command. <pre>
      // catches block code (the common case); explicit opt-out via
      // data-no-copy-attribution covers anything else (e.g. a
      // command-line example wrapped in a div).
      const startEl =
        anchor.nodeType === Node.ELEMENT_NODE
          ? (anchor as Element)
          : anchor.parentElement;
      if (startEl?.closest("pre, [data-no-copy-attribution]")) return;
      // Inline <code> too, but only when the WHOLE selection sits inside
      // it (a long path or command). Prose that merely contains a code
      // span should still get the citation.
      const codeEl = startEl?.closest("code");
      if (codeEl && codeEl.contains(range.commonAncestorContainer)) return;
      // The ancestor check misses selections that SPAN a code block plus
      // surrounding prose (their common ancestor sits above the <pre>).
      // Anything the selection so much as touches opts the copy out.
      for (const el of host.querySelectorAll(
        "pre, [data-no-copy-attribution]"
      )) {
        if (range.intersectsNode(el)) return;
      }

      // Snapshot the HTML version of what the visitor highlighted so
      // links / inline formatting survive the round-trip.
      const fragment = range.cloneContents();
      const wrapper = document.createElement("div");
      wrapper.appendChild(fragment);
      const html = wrapper.innerHTML;

      const display = url.replace(/^https?:\/\//, "");
      // Plain text: one line with the full URL — it auto-linkifies in
      // chat/email and reads clean. (Previously this printed the display
      // URL and the full URL on two lines, which duplicated the link.)
      const plainOut = `${text}\n\nRead more at ${url}`;
      const htmlOut =
        `<div>${html}</div>` +
        `<p style="margin-top:1em;font-size:13px;color:#555;">` +
        `Read more at <a href="${url}">${display}</a>` +
        `</p>`;

      e.clipboardData?.setData("text/plain", plainOut);
      e.clipboardData?.setData("text/html", htmlOut);
      e.preventDefault();
      // Screen-reader users otherwise paste two unexplained extra
      // lines — announce the modification politely.
      setAnnouncement("Source link added to copied text.");
      window.setTimeout(() => setAnnouncement(""), 2000);
    };

    host.addEventListener("copy", handler);
    return () => host.removeEventListener("copy", handler);
  }, [url]);

  return (
    <div ref={ref} className={className}>
      {children}
      <span
        role="status"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          margin: -1,
          padding: 0,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {announcement}
      </span>
    </div>
  );
}
