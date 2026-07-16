import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sortedPosts } from "@/content/blog/registry";

// Per-post OG card, generated instead of hand-drawn: a Win98 window
// with the post title in the real 98.css pixel font, so every post —
// including future ones — gets a distinct share preview for free.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Blog post preview styled as a Windows 98 window";

// Read from public/vendor, not node_modules: this route renders at
// runtime, and the standalone Docker image ships public/ but only
// traced node_modules. Satori takes woff (not woff2); both are
// vendored. Fall back to the bundled default font rather than 500ing
// the card if the file ever moves.
async function loadFont(file: string) {
  try {
    return await readFile(join(process.cwd(), "public/vendor", file));
  } catch {
    return null;
  }
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = sortedPosts.find((p) => p.slug === slug);
  const title = post?.title ?? "danoh.com";
  const summary = post
    ? post.summary.length > 140
      ? `${post.summary.slice(0, 140).trimEnd()}…`
      : post.summary
    : "";
  const date = post
    ? new Date(`${post.date}T00:00:00Z`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";

  const [regular, bold] = await Promise.all([
    loadFont("ms_sans_serif.woff"),
    loadFont("ms_sans_serif_bold.woff"),
  ]);
  const fonts = [
    regular && { name: "MS Sans Serif", data: regular, weight: 400 as const },
    bold && { name: "MS Sans Serif", data: bold, weight: 700 as const },
  ].filter(Boolean) as { name: string; data: Buffer; weight: 400 | 700 }[];

  const bevelOut = {
    borderTop: "6px solid #ffffff",
    borderLeft: "6px solid #ffffff",
    borderRight: "6px solid #404040",
    borderBottom: "6px solid #404040",
  };
  const bevelBtn = {
    borderTop: "3px solid #ffffff",
    borderLeft: "3px solid #ffffff",
    borderRight: "3px solid #404040",
    borderBottom: "3px solid #404040",
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#008080",
          fontFamily: '"MS Sans Serif"',
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 1080,
            backgroundColor: "#c0c0c0",
            boxShadow: "14px 14px 0 rgba(0, 0, 0, 0.35)",
            ...bevelOut,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundImage: "linear-gradient(90deg, #000080, #1084d0)",
              padding: "10px 18px",
              margin: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#ffffff",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              danoh.com — blog
            </div>
            {/* Minimize and maximize are drawn shapes, not glyphs — the
             * pixel font has no ▭/□ and satori's fallback renders a
             * crossed placeholder box. */}
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  width: 44,
                  height: 40,
                  backgroundColor: "#c0c0c0",
                  paddingBottom: 8,
                  ...bevelBtn,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 16,
                    height: 4,
                    backgroundColor: "#000000",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 40,
                  backgroundColor: "#c0c0c0",
                  ...bevelBtn,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 18,
                    height: 16,
                    borderTop: "4px solid #000000",
                    borderLeft: "2px solid #000000",
                    borderRight: "2px solid #000000",
                    borderBottom: "2px solid #000000",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 40,
                  backgroundColor: "#c0c0c0",
                  color: "#000000",
                  fontSize: 26,
                  fontWeight: 700,
                  ...bevelBtn,
                }}
              >
                ×
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "10px 32px 30px",
            }}
          >
            <div style={{ display: "flex", color: "#555555", fontSize: 24 }}>
              {`C:\\BLOG\\${slug.toUpperCase()}.MDX`}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 64,
                fontWeight: 700,
                color: "#000000",
                lineHeight: 1.15,
              }}
            >
              {title}
            </div>
            {summary && (
              <div
                style={{
                  display: "flex",
                  marginTop: 22,
                  fontSize: 30,
                  color: "#333333",
                  lineHeight: 1.4,
                }}
              >
                {summary}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 30,
                paddingTop: 18,
                borderTop: "3px solid #808080",
                fontSize: 26,
              }}
            >
              <div style={{ display: "flex", color: "#333333" }}>
                {date ? `${date} · Daniel Oh` : "Daniel Oh"}
              </div>
              <div
                style={{
                  display: "flex",
                  color: "#000080",
                  fontWeight: 700,
                }}
              >
                danoh.com
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined }
  );
}
