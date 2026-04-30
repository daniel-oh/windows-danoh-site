"use client";

// Next.js segment-level error boundary. Catches errors thrown while
// rendering anything under the root layout's children (i.e. any page
// route) and renders this in place of the crashed segment. For errors
// in the root layout itself, app/global-error.tsx takes over.
//
// Visually identical to /error the route via <TerminalScreen variant="amber">,
// so the visitor reads "this thing broke" the same way whether they
// landed via OAuth redirect or a render crash. Difference: this one
// has a Retry that calls the boundary's reset(); /error the route
// only offers navigation.

import { TerminalScreen, type TerminalLine } from "@/components/TerminalScreen";

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lines: TerminalLine[] = [
    { prefix: "!", prefixStyle: "prompt", text: "fault detected" },
    { prefix: ">", prefixStyle: "angle", text: "a page failed to render." },
    {
      prefix: ">",
      prefixStyle: "angle",
      text: "retry, or head back to safer ground.",
      cursor: true,
    },
  ];

  return (
    <TerminalScreen
      variant="amber"
      lines={lines}
      actions={[
        {
          kind: "button",
          label: "[ Retry ]",
          onClick: () => reset(),
          primary: true,
        },
        { kind: "link", label: "[ Return to desktop ]", href: "/" },
      ]}
      signature={error.digest ? `ref // ${error.digest}` : undefined}
    />
  );
}
