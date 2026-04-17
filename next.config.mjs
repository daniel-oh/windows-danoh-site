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
          // Enforced CSP. Constraints are the third-party origins we
          // actually use (PostHog / Plausible / Stripe / unpkg) plus
          // 'unsafe-inline' + 'unsafe-eval' which Next.js's runtime
          // requires. If a new integration needs a host, widen the
          // allowlist in CSP below. Flip back to "…-Report-Only" to
          // observe-only if something breaks in production.
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
        ],
      },
    ];
  },
};

// unsafe-inline + unsafe-eval are required by Next.js's bootstrap +
// webpack runtime + inline React styles + 98.css inline style props.
// PostHog: api hosts are *.i.posthog.com, assets are us/eu-assets.
// Plausible: custom self-hosted domain.
// Stripe: script bundle + REST API.
// unpkg: 98.css loaded from the iframe program page.
// frame-src blob:/data:/self: srcDoc iframes and same-origin program frames.
// frame-ancestors 'self': modern equivalent of X-Frame-Options SAMEORIGIN.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.i.posthog.com https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://analytics.wuxiamaxxing.com https://js.stripe.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.i.posthog.com https://us.i.posthog.com https://eu.i.posthog.com https://api.stripe.com https://analytics.wuxiamaxxing.com",
  "frame-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

export default withMDX(nextConfig);
