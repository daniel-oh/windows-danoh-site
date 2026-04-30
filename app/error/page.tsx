import { TerminalScreen } from "@/components/TerminalScreen";
import { buildMetadata } from "@/lib/buildMetadata";

// Route-level /error landing page. Reached when a server action
// redirects here — most commonly OAuth failure (see lib/auth/actions.ts).
// This is NOT an error boundary; those live at app/error.tsx (segment)
// and app/global-error.tsx (root). All three share <TerminalScreen />.

export const metadata = buildMetadata({
  title: "Error · Daniel Oh",
  description: "Something didn't complete. The site is fine.",
  url: "https://danoh.com/error",
  noindex: true,
});

export default function ErrorPage() {
  return (
    <TerminalScreen
      variant="amber"
      lines={[
        { prefix: "!", prefixStyle: "prompt", text: "fault detected" },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "an operation did not complete.",
        },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "the site is fine. try again.",
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
        { kind: "link", label: "[ Read the blog ]", href: "/blog" },
      ]}
      signature="danoh.com // status: recoverable"
    />
  );
}
