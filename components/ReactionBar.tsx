"use client";

import { REACTIONS, useReactions } from "@/lib/useReactions";

// Shared between the in-OS Blog program and the standalone /blog/[slug]
// pages — SEO visitors (the majority) previously had no way to react.
// `bare` renders just the button row, for hosts (the post page's
// end-of-file card) that provide their own heading and framing.
export function ReactionBar({
  slug,
  bare = false,
}: {
  slug: string;
  bare?: boolean;
}) {
  const { counts, mine, toggle } = useReactions(slug);
  const buttons = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {REACTIONS.map((r) => {
          const active = mine.includes(r.key);
          const count = counts[r.key] ?? 0;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={active}
              aria-label={`${r.label} this post`}
              onClick={() => toggle(r.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                minHeight: 40,
                fontSize: 14,
                fontWeight: active ? 700 : 400,
              }}
            >
              <span style={{ fontSize: 17 }}>{r.emoji}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {count}
              </span>
            </button>
          );
        })}
    </div>
  );
  if (bare) return buttons;
  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 12,
        borderTop: "1px solid #808080",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, color: "#444" }}>How did this land?</div>
      {buttons}
    </div>
  );
}
