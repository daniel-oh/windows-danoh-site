import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daniel Oh",
    short_name: "danoh.com",
    description:
      "Engineer who designs. Operator who writes. A Win98 desktop, a blog, and a few experiments.",
    start_url: "/",
    display: "standalone",
    background_color: "#008080",
    theme_color: "#008080",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
