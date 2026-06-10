import { OS } from "@/components/OS";
import { StaticIntro } from "@/components/StaticIntro";
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
      description:
        "Platform engineer at Nike. Michigan Engineering alum. Builds infrastructure that teams ship on, and side projects that keep him learning.",
      url: "https://danoh.com",
      email: "mailto:hello@danoh.com",
      // image/worksFor/alumniOf are what disambiguate an extremely
      // common name in the knowledge graph.
      image: "https://danoh.com/headshot.jpg",
      worksFor: { "@type": "Organization", name: "Nike" },
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name: "University of Michigan",
      },
      sameAs: [
        "https://www.linkedin.com/in/daniel-oh/",
        "https://github.com/daniel-oh",
        "https://x.com/danohstudio",
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
        <OS staticIntro={<StaticIntro />} />
      </ActionsProvider>
    </FlagsProvider>
  );
}
