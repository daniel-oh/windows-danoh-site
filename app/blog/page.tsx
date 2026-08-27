import Image from "next/image";
import Link from "next/link";
import { sortedPosts } from "@/content/blog/registry";
import { buildMetadata } from "@/lib/buildMetadata";
import { ExternalArrow } from "@/components/ExternalArrow";
import { SkipLink } from "@/components/SkipLink";
import { BlogIndexContent } from "./BlogIndexContent";
import { StatusBarCount, StatusBarHint } from "./StatusBarCount";
import styles from "./blog.module.css";
import { FolderIcon } from "./FolderIcon";

// This route is fully static, so `new Date()` here would freeze at build
// time and go stale every January until the next deploy. The newest
// post's year is honest and only moves when content does.
const copyrightYear = sortedPosts.reduce(
  (y, p) => Math.max(y, new Date(p.date).getFullYear()),
  0
);

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
      <div className={`${styles.shell} ${styles.shellWide}`}>
        <div className={styles.titleBar}>
          <FolderIcon />
          <div className={styles.titleBarText}>C:\danoh\blog</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        {/* Decorative Explorer dressing — like the real Explorer's menu
         * bar, it mostly just sits there. Hidden from AT so screen
         * readers don't announce menus that do nothing. */}
        <div className={styles.menuStrip} aria-hidden="true">
          <span className={styles.menuItem}>
            <u>F</u>ile
          </span>
          <span className={styles.menuItem}>
            <u>E</u>dit
          </span>
          <span className={styles.menuItem}>
            <u>V</u>iew
          </span>
          <span className={styles.menuItem}>
            <u>H</u>elp
          </span>
        </div>
        <div className={styles.addressRow} aria-hidden="true">
          <span className={styles.addressLabel}>Address</span>
          <div className={styles.addressField}>
            <FolderIcon className={styles.addressIcon} />
            C:\danoh\blog
          </div>
        </div>
        <header className={styles.tagline}>
          <Image
            src="/headshot.jpg"
            alt="Daniel Oh"
            width={40}
            height={40}
            className={styles.taglineAvatar}
          />
          <div>
            <div className={styles.taglineLine1}>
              Engineer who designs. Operator who writes.
            </div>
            <div className={styles.taglineLine2}>
              AI, craft, and the work of building things that last.
            </div>
          </div>
        </header>
        <main id="main" className={`${styles.body} ${styles.bodyProse}`}>
          <BlogIndexContent posts={sortedPosts} />
          <p className={styles.copyright}>
            © {copyrightYear} Daniel Oh · danoh.com
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
              <Link href="/terms" className={styles.footerLink}>
                Terms
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
            <StatusBarCount total={sortedPosts.length} />
          </span>
          <span className={styles.statusCell}>
            <StatusBarHint />
          </span>
          <span className={styles.statusCell}>danoh.com</span>
        </div>
      </div>
    </div>
  );
}
