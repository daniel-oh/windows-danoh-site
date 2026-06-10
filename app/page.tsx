import { OS } from "@/components/OS";
import { FlagsProvider } from "@/flags/context";
import { getFlagsForUser } from "@/flags/flags";
import { ActionsProvider } from "@/lib/actions/ActionsProvider";
import { login, logout } from "@/lib/auth/actions";
import { getUser } from "@/lib/auth/getUser";
import type { Metadata } from "next";

// Title/description/OG inherit from the root layout; the homepage only
// needs to pin its own canonical (blog posts emit theirs, `/` didn't).
export const metadata: Metadata = {
  alternates: { canonical: "https://danoh.com" },
};

// Entity anchor for the personal brand: blog posts' BlogPosting JSON-LD
// points author.sameAs at these profiles, but nothing declared the
// Person at the root. This is what ties "Daniel Oh" searches together.
const personLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://danoh.com/#person",
      name: "Daniel Oh",
      jobTitle: "Platform Engineer",
      url: "https://danoh.com",
      email: "mailto:hello@danoh.com",
      sameAs: [
        "https://www.linkedin.com/in/daniel-oh/",
        "https://github.com/daniel-oh",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://danoh.com/#website",
      name: "danoh.com",
      url: "https://danoh.com",
      publisher: { "@id": "https://danoh.com/#person" },
    },
  ],
};

export default async function Home() {
  const user = await getUser();

  return (
    <FlagsProvider flags={getFlagsForUser(user)}>
      <ActionsProvider actions={{ login, logout }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
        />
        <OS />
      </ActionsProvider>
    </FlagsProvider>
  );
}
