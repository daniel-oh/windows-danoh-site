import { login } from "@/lib/auth/actions";
import { buildMetadata } from "@/lib/buildMetadata";

export const metadata = buildMetadata({
  title: "Log in · Daniel Oh",
  description: "Sign in to danoh.com.",
  url: "https://danoh.com/login",
  noindex: true,
});

export default function LoginPage() {
  return (
    <form>
      <button formAction={login}>Log in</button>
    </form>
  );
}
