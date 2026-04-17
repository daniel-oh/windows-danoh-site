import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daniel Oh",
    short_name: "danoh.com",
    description: "Engineer, builder, and curious person. Chicago.",
    start_url: "/",
    display: "standalone",
    background_color: "#008080",
    theme_color: "#008080",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
