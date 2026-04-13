import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "98.css";
import "./globals.css";
import { CSPostHogProvider } from "@/lib/CSPosthogProvider";
import { APIProvider } from "@/lib/api/APIProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Daniel Oh | Platform Engineer & Builder",
  description: "Sr. Platform Engineer at Nike. I build the platforms that engineering teams actually want to use. Michigan Engineering. Azure Expert certified. Five ventures on the side.",
  metadataBase: new URL("https://danoh.com"),
  openGraph: {
    title: "Daniel Oh | Platform Engineer & Builder",
    description: "I build the platforms that engineering teams actually want to use. Explore my retro AI-powered desktop, generate apps on the fly, and check out what I'm working on.",
    url: "https://danoh.com",
    siteName: "danoh.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Daniel Oh - Sr. Platform Engineer at Nike",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Daniel Oh | Platform Engineer & Builder",
    description: "I build the platforms that engineering teams actually want to use. Explore my retro AI-powered desktop.",
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
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <CSPostHogProvider>
        <APIProvider>
          <body className={inter.className}>{children}</body>
        </APIProvider>
      </CSPostHogProvider>
    </html>
  );
}
