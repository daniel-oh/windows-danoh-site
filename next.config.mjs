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
    // Only these same-origin paths go through the optimizer. Without an
    // allowlist /_next/image?url=<anything local> is an open resize
    // service (scanners hit it with url=/ and the logs fill with
    // "isn't a valid image"); with it, junk URLs 400 before any fetch.
    // Static imports resolve under /_next/static/media.
    localPatterns: [
      { pathname: "/blog/**" },
      { pathname: "/headshot.jpg" },
      { pathname: "/headshot-resume.jpg" },
      { pathname: "/_next/static/media/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  transpilePackages: ["file-system-access", "fetch-blob"],
  // Keep .tsx etc as pages. MDX files are content modules, not routes,
  // so we deliberately don't add "mdx" here.
  // www serves the whole site as a 200 duplicate host otherwise —
  // canonical tags mitigate it, but a 301 consolidates signals and
  // stops the crawl-budget waste. Done here rather than in Cloudflare
  // so it lives in the repo.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.danoh.com" }],
        destination: "https://danoh.com/:path*",
        permanent: true,
      },
    ];
  },
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
          // actually use (PostHog / Plausible / Stripe) plus
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

// script-src 'unsafe-inline' is a DELIBERATE, load-bearing constraint,
// not an oversight: generated apps run in srcDoc sandboxed iframes
// (Iframe.tsx, sandbox="allow-scripts"), and a srcDoc document inherits
// its embedder's CSP. Those apps are arbitrary LLM-written HTML full of
// inline <script> and event handlers that cannot carry a per-request
// nonce — so a nonce-based policy (which disables 'unsafe-inline')
// would break the core "AI generates and runs an app in your browser"
// feature. Removing 'unsafe-inline' would require serving generated
// apps from a separate sandbox origin so the main document could go
// strict; that's a tracked future re-architecture, not a quick swap.
// 'unsafe-eval' (script) is required by Next.js's webpack runtime, and
// 'unsafe-inline' (style) by inline React styles + 98.css inline props.
// PostHog: api hosts are *.i.posthog.com, assets are us/eu-assets.
// Plausible: custom self-hosted domain.
// Stripe: script bundle + REST API.
// 98.css (generated-program iframes) and the Rive WASM are now both
// self-hosted, so no unpkg allowance is needed. Inter is self-hosted by
// next/font, so no Google Fonts allowance is needed either.
// frame-src blob:/data:/self: srcDoc iframes and same-origin program frames.
// frame-ancestors 'self': modern equivalent of X-Frame-Options SAMEORIGIN.
const CSP = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' is required for Rive's WebAssembly runtime;
  // 'unsafe-eval' covers Next.js's webpack runtime.
  // cloudflareinsights: Cloudflare auto-injects its Web Analytics beacon
  // at the edge; without the allowance every pageview logs a CSP error
  // and the zone's RUM data collects nothing.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://*.i.posthog.com https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://analytics.wuxiamaxxing.com https://js.stripe.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  // 98.css (self-hosted at /vendor/98.css) loads ms_sans_serif.woff2
  // from the same origin inside generated-program iframes — covered by
  // 'self'.
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.i.posthog.com https://us.i.posthog.com https://eu.i.posthog.com https://api.stripe.com https://analytics.wuxiamaxxing.com https://cloudflareinsights.com",
  "frame-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

export default withMDX(nextConfig);
