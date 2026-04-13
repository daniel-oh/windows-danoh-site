import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "98.css";
import "./globals.css";
import { CSPostHogProvider } from "@/lib/CSPosthogProvider";
import { APIProvider } from "@/lib/api/APIProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Daniel Oh",
  description: "Personal website of Daniel Oh",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, user-scalable=no"
      />
      <CSPostHogProvider>
        <APIProvider>
          <body className={inter.className}>{children}</body>
        </APIProvider>
      </CSPostHogProvider>
    </html>
  );
}
