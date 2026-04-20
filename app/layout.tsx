import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "98.css";
// github-dark, not github — our blog code blocks use a near-black
// background (#1a1a1a) in both the in-OS Blog window and the standalone
// /blog/[slug] page. The light github theme ships dark token colors,
// so on our dark background everything reads as black-on-black. The
// dark theme's tokens are engineered for this exact contrast.
import "highlight.js/styles/github-dark.css";
import "./globals.css";
import { CSPostHogProvider } from "@/lib/CSPosthogProvider";
import { APIProvider } from "@/lib/api/APIProvider";
import { ChunkReloadGuard } from "@/components/ChunkReloadGuard";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Daniel Oh · Engineer who designs. Operator who writes.",
  description:
    "AI, craft, and the work of building things that last. Personal site of Daniel Oh.",
  metadataBase: new URL("https://danoh.com"),
  openGraph: {
    title: "Daniel Oh · Engineer who designs. Operator who writes.",
    description:
      "AI, craft, and the work of building things that last. Personal site of Daniel Oh.",
    url: "https://danoh.com",
    siteName: "danoh.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Daniel Oh",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daniel Oh · Engineer who designs. Operator who writes.",
    description:
      "AI, craft, and the work of building things that last. Personal site of Daniel Oh.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords: ["Daniel Oh", "platform engineer", "Nike", "cybersecurity", "DevOps", "Kubernetes", "cloud infrastructure", "Michigan Engineering"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Daniel Oh · Blog"
          href="/feed.xml"
        />
        <script
          defer
          data-domain="danoh.com"
          src="https://analytics.wuxiamaxxing.com/js/script.file-downloads.hash.outbound-links.pageview-props.tagged-events.js"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }",
          }}
        />
      </head>
      <CSPostHogProvider>
        <APIProvider>
          <body className={inter.className}>
            <ChunkReloadGuard />
            {children}
          </body>
        </APIProvider>
      </CSPostHogProvider>
    </html>
  );
}
