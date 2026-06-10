import { login } from "@/lib/auth/actions";
import { TerminalScreen } from "@/components/TerminalScreen";
import { buildMetadata } from "@/lib/buildMetadata";

export const metadata = buildMetadata({
  title: "Log in · Daniel Oh",
  description: "Sign in to danoh.com.",
  url: "https://danoh.com/login",
  noindex: true,
});

// Operator-only Google OAuth entry. Visitors should never land here
// (it's noindex and nothing links to it), but it was the one page on
// the site wearing browser-default chrome — so it gets the same
// retro-terminal shell as /logout and /error.
export default function LoginPage() {
  return (
    <TerminalScreen
      variant="green"
      lines={[
        { prefix: "$", prefixStyle: "prompt", text: "login" },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "operator authentication required.",
        },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "awaiting credentials",
          cursor: true,
        },
      ]}
      actions={[
        {
          kind: "submit",
          label: "[ Continue with Google ]",
          action: login,
          primary: true,
        },
        { kind: "link", label: "[ Back to the desktop ]", href: "/" },
      ]}
      signature="danoh.com // daniel oh"
    />
  );
}
