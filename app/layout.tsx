import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "98.css";
import "./globals.css";
import { CSPostHogProvider } from "@/lib/CSPosthogProvider";
import { APIProvider } from "@/lib/api/APIProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Daniel Oh",
  description: "Engineer, builder, and curious person. Chicago.",
  metadataBase: new URL("https://danoh.com"),
  openGraph: {
    title: "Daniel Oh",
    description: "Engineer, builder, and curious person. Chicago.",
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
    title: "Daniel Oh",
    description: "Engineer, builder, and curious person. Chicago.",
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
