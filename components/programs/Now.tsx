"use client";

import Markdown from "react-markdown";
import { nowMarkdown, nowUpdatedAt } from "@/content/now";

export function Now() {
  return (
    <div
      style={{
        padding: 16,
        overflow: "auto",
        flex: 1,
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: "1px solid #808080",
          paddingBottom: 6,
          marginBottom: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18 }}>Right Now</h1>
        <span style={{ fontSize: 11, color: "#555" }}>
          Updated {nowUpdatedAt}
        </span>
      </div>
      <Markdown
        components={{
          h2: ({ children }) => (
            <h2 style={{ fontSize: 14, marginTop: 16, marginBottom: 4 }}>
              {children}
            </h2>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: "#000080" }}>
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: "4px 0 8px 0", paddingLeft: 20 }}>{children}</ul>
          ),
          li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
          p: ({ children }) => (
            <p style={{ margin: "4px 0 8px 0" }}>{children}</p>
          ),
        }}
      >
        {nowMarkdown}
      </Markdown>
    </div>
  );
}
