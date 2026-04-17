import createMDX from "@next/mdx";

// Plugins are passed as string identifiers so Turbopack can serialize
// them (function refs would trip "does not have serializable options").
// @next/mdx resolves these to modules at build time.
//
// Note: rehype-raw is NOT used here. MDX natively supports JSX / raw HTML
// in posts (`<video>`, `<iframe>`, `<Rive />`), so rehype-raw is both
// redundant and actively breaks when it encounters MDX ESM nodes like
// `export const meta = ...`.
const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [["remark-gfm"]],
    rehypePlugins: [["rehype-highlight", { ignoreMissing: true }]],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ hostname: "localhost" }],
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: ["file-system-access", "fetch-blob"],
  // Keep .tsx etc as pages. MDX files are content modules, not routes,
  // so we deliberately don't add "mdx" here.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default withMDX(nextConfig);
