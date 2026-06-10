import Link from "next/link";
import { sortedPosts } from "@/content/blog/posts";

// Server-rendered boot screen. This is the SEO fix for the SPA problem:
// the raw homepage HTML previously contained ~41 characters of icon
// labels — no heading, no bio, no internal links — so non-rendering
// crawlers (Bing's fallback, GPTBot, ClaudeBot, social scrapers) saw
// empty chrome, and even Google's rendered DOM had no anchor graph.
//
// This window is in the initial server payload (it's also the LCP
// element, server-painted instead of hydration-gated), styled as the
// Win98 window the OS is about to draw, and unmounts the moment the
// real Welcome window opens — visitors read it as a boot splash.
export function StaticIntro() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div className="window" style={{ width: 560, maxWidth: "94vw" }}>
        <div className="title-bar">
          <div className="title-bar-text">Welcome to danoh.com</div>
        </div>
        <div
          className="window-body"
          style={{ padding: "12px 16px", fontSize: 13, lineHeight: 1.55 }}
        >
          <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Daniel Oh</h1>
          <p style={{ margin: "0 0 8px", fontStyle: "italic" }}>
            Engineer who designs. Operator who writes.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            Platform engineer at Nike. Michigan Engineering alum. I build
            infrastructure that teams ship on, and side projects that keep me
            learning.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            This site is a Windows 98 desktop where you describe an app and
            the AI builds it in front of you. Read the{" "}
            <Link href="/blog">blog</Link>, grab the{" "}
            <a href="/Daniel_Oh_Resume.pdf">resume</a>, or say hello at{" "}
            <a href="mailto:hello@danoh.com">hello@danoh.com</a>.
          </p>
          <p style={{ margin: "0 0 4px", fontWeight: "bold", fontSize: 12 }}>
            Latest from the blog
          </p>
          <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 12 }}>
            {sortedPosts.slice(0, 5).map((p) => (
              <li key={p.slug} style={{ margin: "2px 0" }}>
                <Link href={`/blog/${p.slug}`}>{p.title}</Link>
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, fontSize: 11 }}>
            <a
              href="https://github.com/daniel-oh"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            {" · "}
            <a
              href="https://www.linkedin.com/in/daniel-oh/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            {" · "}
            <Link href="/privacy">Privacy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
