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
      // Declared sizes must match the files: Chrome's installability
      // check and Lighthouse both flag a mismatch. Both PNGs are 256px.
      {
        src: "/icon.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/icon-maskable.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
