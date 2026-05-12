import Link from "next/link";
import { sortedPosts } from "@/content/blog/posts";
import { buildMetadata } from "@/lib/buildMetadata";
import { ExternalArrow } from "@/components/ExternalArrow";
import { BlogIndexContent } from "./BlogIndexContent";
import styles from "./blog.module.css";

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
  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.titleBar}>
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
        <div className={styles.body}>
          <BlogIndexContent posts={sortedPosts} />
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Daniel Oh · danoh.com
          </p>
          <div className={styles.footer}>
            <Link href="/" className={styles.footerLink}>
              ← Back to the desktop
            </Link>
            <a href="/feed.xml" className={styles.footerLink}>
              RSS<ExternalArrow />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
