import { TerminalScreen } from "@/components/TerminalScreen";
import { buildMetadata } from "@/lib/buildMetadata";

// Root not-found page. Without this, a mistyped URL gets the stock
// black-on-white Next.js 404 — the one place the retro costume slips.
// Shares <TerminalScreen /> with /error, /logout, and the error
// boundaries so every dead end stays on-brand.

export const metadata = buildMetadata({
  title: "File not found · Daniel Oh",
  description: "That path doesn't exist on this disk.",
  url: "https://danoh.com/404",
  noindex: true,
});

export default function NotFound() {
  return (
    <TerminalScreen
      variant="amber"
      lines={[
        { prefix: "!", prefixStyle: "prompt", text: "file not found" },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "the path you typed does not exist on this disk.",
        },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "abort, retry, fail?",
          cursor: true,
        },
      ]}
      actions={[
        {
          kind: "link",
          label: "[ Return to desktop ]",
          href: "/",
          primary: true,
        },
        { kind: "link", label: "[ Browse the blog ]", href: "/blog" },
      ]}
      signature="danoh.com // status: 404"
    />
  );
}
