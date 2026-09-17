import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "98.css";
import "./globals.css";
import { CSPostHogProvider } from "@/lib/CSPosthogProvider";
import { ChunkReloadGuard } from "@/components/ChunkReloadGuard";

const inter = Inter({ subsets: ["latin"], display: "swap" });

// One copy each. These were written out three times (metadata, openGraph,
// twitter) and had to be edited in lockstep. Not lib/buildMetadata.ts:
// that helper sets a canonical URL, and anything on the ROOT layout is
// inherited by every page that does not override it, which would mark
// them all as duplicates of the home page.
// Title case here only: this is the browser tab and the share-card
// headline. The on-page tagline stays sentence case.
const TITLE = "Daniel Oh · Curator + Creative Technologist";
const DESCRIPTION =
  "Focused on design, craft, and the work of building things that last. The site is a retro Windows 98 desktop, a blog, and a few experiments. Look around.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://danoh.com"),
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
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
    site: "@danohstudio",
    creator: "@danohstudio",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords: ["Daniel Oh", "platform engineer", "Nike", "cybersecurity", "DevOps", "Kubernetes", "cloud infrastructure", "Michigan Engineering"],
  authors: [{ name: "Daniel Oh", url: "https://danoh.com" }],
  icons: {
    // Setting `icons` at all replaces the app/icon.png file-convention
    // link, so the tab favicon has to be listed here explicitly too.
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "256x256", type: "image/png" },
    ],
    // iOS ignores manifest icons; without this, add-to-home-screen
    // falls back to a page screenshot.
    apple: "/apple-touch-icon.png",
  },
  creator: "Daniel Oh",
  publisher: "Daniel Oh",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  // cover + safe-area padding on the taskbar handles notched iPhones
  // in installed-PWA mode; themeColor tints browser chrome Win98 teal.
  viewportFit: "cover",
  themeColor: "#008080",
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
        <body className={inter.className}>
          <ChunkReloadGuard />
          {children}
        </body>
      </CSPostHogProvider>
    </html>
  );
}
