import Link from "next/link";
import { buildMetadata } from "@/lib/buildMetadata";
import { ExternalArrow } from "@/components/ExternalArrow";
import { SkipLink } from "@/components/SkipLink";
import { Resume } from "@/components/programs/Resume";
import { CaptionIcon } from "../blog/CaptionIcon";
import styles from "../blog/blog.module.css";

export const metadata = buildMetadata({
  title: "Resume · Daniel Oh",
  description:
    "Daniel Oh: Sr. Platform Engineer at Nike. 8+ years of cloud-native infrastructure across Azure, AWS, and GCP. Kubernetes, Terraform, and the platforms engineering teams ship on.",
  url: "https://danoh.com/resume",
});

// The resume was previously reachable only as a raw PDF and inside the
// desktop program — invisible to search. This page is the indexable
// surface: the same Resume component the desktop renders (static, so
// it ships zero hydration here), framed as Daniel_Oh_Resume.doc in the
// site's document-window chrome.

export default function ResumePage() {
  // ProfilePage about the SAME Person entity the homepage declares
  // (matching @id), so crawlers merge the two instead of seeing twins.
  const ld = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": "https://danoh.com/resume#profile",
    url: "https://danoh.com/resume",
    name: "Daniel Oh · Resume",
    mainEntity: {
      "@type": "Person",
      "@id": "https://danoh.com/#person",
      name: "Daniel Oh",
      jobTitle: "Sr. Platform Engineer",
      worksFor: { "@type": "Organization", name: "Nike" },
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name: "University of Michigan",
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Chicago",
        addressRegion: "IL",
      },
      email: "mailto:hello@danoh.com",
      image: "https://danoh.com/headshot.jpg",
      url: "https://danoh.com",
      sameAs: [
        "https://www.linkedin.com/in/daniel-oh/",
        "https://github.com/daniel-oh",
        "https://x.com/danohstudio",
      ],
    },
  };
  return (
    <div className={styles.page}>
      <SkipLink />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <div className={`${styles.shell} ${styles.shellWide}`}>
        <div className={styles.titleBar}>
          <CaptionIcon />
          <div className={styles.titleBarText}>
            Daniel_Oh_Resume.doc · danoh.com
          </div>
          <a
            href="/Daniel_Oh_Resume.pdf"
            download
            className={styles.titleBarLink}
          >
            Download PDF
          </a>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        <main id="main">
          <Resume />
        </main>
        <div className={styles.statusBar}>
          <span className={`${styles.statusCell} ${styles.grow}`}>
            Daniel Oh · Sr. Platform Engineer · Nike
          </span>
          <span className={styles.statusCell}>danoh.com</span>
        </div>
      </div>
    </div>
  );
}
