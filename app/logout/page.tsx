import { TerminalScreen } from "@/components/TerminalScreen";
import { buildMetadata } from "@/lib/buildMetadata";

export const metadata = buildMetadata({
  title: "Logged off · Daniel Oh",
  description: "Session terminated. You are signed out of danoh.com.",
  url: "https://danoh.com/logout",
  noindex: true,
});

// Matrix-style terminal farewell. Phosphor green on black. All visual
// + a11y posture (staggered reveal, blinking cursor, scanline overlay,
// reduced-motion bypass) lives in <TerminalScreen />.
export default function LoggedOff() {
  return (
    <TerminalScreen
      variant="green"
      lines={[
        { prefix: "$", prefixStyle: "prompt", text: "logout" },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "disconnecting from danoh.com...",
        },
        { prefix: ">", prefixStyle: "angle", text: "session terminated." },
        {
          prefix: ">",
          prefixStyle: "angle",
          text: "ready for next login",
          cursor: true,
        },
      ]}
      actions={[
        { kind: "link", label: "[ Restart ]", href: "/", primary: true },
        { kind: "link", label: "[ Browse Archive ]", href: "/blog" },
      ]}
      signature="danoh.com // daniel oh"
    />
  );
}
