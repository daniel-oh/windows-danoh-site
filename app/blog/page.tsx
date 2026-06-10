import Link from "next/link";
import { sortedPosts } from "@/content/blog/registry";
import { buildMetadata } from "@/lib/buildMetadata";
import { ExternalArrow } from "@/components/ExternalArrow";
import { SkipLink } from "@/components/SkipLink";
import { BlogIndexContent } from "./BlogIndexContent";
import styles from "./blog.module.css";
import { CaptionIcon } from "./CaptionIcon";

export const metadata = buildMetadata({
  title: "Blog · Daniel Oh",
  description:
    "Posts on AI infrastructure, brand decisions, and the depth layer below the model layer. Writing by Daniel Oh.",
  url: "https://danoh.com/blog",
});

// Page shell + metadata stays a server component (SSR, SEO). The list
// and search live in BlogIndexContent as a client island — posts are
// passed in as a static prop so we don't force the whole shell client.
export default function BlogIndex() {
  // Blog + ItemList structured data: the index had none while the
  // homepage and posts both carry theirs.
  const ld = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": "https://danoh.com/blog#blog",
    name: "Daniel Oh · Blog",
    url: "https://danoh.com/blog",
    author: {
      "@type": "Person",
      name: "Daniel Oh",
      url: "https://danoh.com",
    },
    blogPost: sortedPosts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://danoh.com/blog/${p.slug}`,
      datePublished: p.date,
    })),
  };
  return (
    <div className={styles.page}>
      <SkipLink />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <div className={styles.shell}>
        <div className={styles.titleBar}>
          <CaptionIcon />
          <div className={styles.titleBarText}>Blog · danoh.com</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        <header className={styles.tagline}>
          <div className={styles.taglineLine1}>
            Engineer who designs. Operator who writes.
          </div>
          <div className={styles.taglineLine2}>
            AI, craft, and the work of building things that last.
          </div>
        </header>
        <main id="main" className={styles.body}>
          <BlogIndexContent posts={sortedPosts} />
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Daniel Oh · danoh.com
          </p>
          <div className={styles.footer}>
            <Link href="/" className={styles.footerLink}>
              ← Back to the desktop
            </Link>
            <span>
              <Link href="/privacy" className={styles.footerLink}>
                Privacy
              </Link>
              {" · "}
              <a href="/feed.xml" className={styles.footerLink}>
                RSS<ExternalArrow />
              </a>
            </span>
          </div>
        </main>
        <div className={styles.statusBar}>
          <span className={`${styles.statusCell} ${styles.grow}`}>
            {sortedPosts.length} posts
          </span>
          <span className={styles.statusCell}>danoh.com</span>
        </div>
      </div>
    </div>
  );
}
