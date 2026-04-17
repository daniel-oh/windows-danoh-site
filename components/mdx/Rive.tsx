"use client";

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import type { RiveProps } from "./RiveInner";

// Lazy-load the Rive runtime (~300 KB gzipped incl. WASM) so posts
// without any <Rive /> embed don't pay the download cost.
// `ssr: false` means the canvas renders only after hydration; for
// SEO the <figure> / <figcaption> + surrounding prose do the indexing
// work (the canvas itself isn't discoverable by crawlers anyway).
export const Rive = dynamic<RiveProps>(
  () => import("./RiveInner").then((m) => m.RiveInner),
  {
    ssr: false,
    loading: () => <RivePlaceholder />,
  }
);

const placeholderStyle: CSSProperties = {
  margin: "16px 0",
  width: "100%",
  height: 300,
  background:
    "linear-gradient(135deg, #ebebeb 0%, #d8d8d8 50%, #ebebeb 100%)",
  border: "1px solid #808080",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  color: "#555",
  fontStyle: "italic",
};

function RivePlaceholder() {
  return (
    <div aria-hidden="true" style={placeholderStyle}>
      Loading animation…
    </div>
  );
}
