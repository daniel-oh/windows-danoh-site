import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  sortedPosts,
  getAdjacentPosts,
  getRelatedPosts,
  type BlogPost,
} from "@/content/blog/registry";
import { getPostComponent, PostBody } from "@/content/blog/registry";
import { CopyAttribution } from "@/components/CopyAttribution";
import { ReactionBar } from "@/components/ReactionBar";
import { ExternalArrow } from "@/components/ExternalArrow";
import { SkipLink } from "@/components/SkipLink";
import styles from "../blog.module.css";
import { CaptionIcon } from "../CaptionIcon";
import { ReadingProgress } from "./ReadingProgress";
import { TocRail } from "./TocRail";
import { BackToTop } from "./BackToTop";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return sortedPosts.map((p) => ({ slug: p.slug }));
}

function getPost(slug: string): BlogPost | undefined {
  return sortedPosts.find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found · Daniel Oh" };
  const url = `https://danoh.com/blog/${post.slug}`;
  // og:image comes from the sibling opengraph-image.tsx (a generated
  // per-post Win98 card) via the file convention, which takes precedence
  // over anything set here — so no openGraph.images entry. Twitter and
  // JSON-LD are hand-built absolute strings without metadataBase
  // resolution, so they reference the same route explicitly.
  const cardImage = `https://danoh.com/blog/${post.slug}/opengraph-image`;
  return {
    title: `${post.title} · Daniel Oh`,
    description: post.summary,
    keywords: post.tags,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.summary,
      url,
      type: "article",
      publishedTime: post.date,
      // article:author expects a profile URL, not a display name (the
      // name lives in JSON-LD's Person).
      authors: ["https://danoh.com"],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      site: "@danohstudio",
      creator: "@danohstudio",
      title: post.title,
      description: post.summary,
      images: [cardImage],
    },
  };
}

export default async function Post({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  // A meta without a component (drift the prebuild check should have
  // caught) must hard-404, not ship an indexed page with an empty body.
  if (!getPostComponent(slug)) notFound();

  const postYear = post.date.slice(0, 4);
  const authorPerson = {
    "@type": "Person",
    name: post.author,
    url: "https://danoh.com",
    // sameAs links resolve the byline to verified profiles so Google
    // Knowledge Graph and other crawlers tie the article back to the
    // same identity instead of a free-floating name string.
    sameAs: [
      "https://www.linkedin.com/in/daniel-oh/",
      "https://github.com/daniel-oh",
    ],
  } as const;

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.date,
    // Always provide an image — required for Discover/article rich
    // treatment. The generated per-post card (opengraph-image.tsx).
    image: [`https://danoh.com/blog/${post.slug}/opengraph-image`],
    author: authorPerson,
    keywords: post.tags.join(", "),
    url: `https://danoh.com/blog/${post.slug}`,
    mainEntityOfPage: `https://danoh.com/blog/${post.slug}`,
    // Google's Article rich-result guidelines require publisher to be an
    // Organization carrying a logo ImageObject; a Person here makes the
    // post ineligible. Author stays the Person (the byline identity).
    publisher: {
      "@type": "Organization",
      name: "danoh.com",
      url: "https://danoh.com",
      logo: {
        "@type": "ImageObject",
        url: "https://danoh.com/icon-192.png",
        width: 192,
        height: 192,
      },
    },
    copyrightHolder: authorPerson,
    copyrightYear: Number(postYear),
    // CC-style implicit terms: byline + canonical link required on
    // reposts; we treat the CopyAttribution snippet as the
    // machine-readable expression of the same.
    creditText: `${post.author} · danoh.com/blog/${post.slug}`,
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://danoh.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://danoh.com/blog" },
      { "@type": "ListItem", position: 3, name: post.title },
    ],
  };

  return (
    <div className={styles.page}>
      <SkipLink />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <div className={`${styles.shell} ${styles.shellWide}`}>
        <div className={`${styles.titleBar} ${styles.titleBarSticky}`}>
          <CaptionIcon />
          <div className={styles.titleBarText}>{post.slug}.txt · danoh.com</div>
          <Link href="/blog" className={styles.titleBarLink}>
            ← All posts
          </Link>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        <article id="main" className={`${styles.body} ${styles.bodyProse}`}>
          <div className={styles.byline}>
            <Image
              src="/headshot.jpg"
              alt={post.author}
              width={32}
              height={32}
              className={styles.bylineAvatar}
            />
            <div className={styles.meta}>
              <span className={styles.bylineAuthor}>{post.author}</span>
              <span>·</span>
              <time dateTime={post.date}>{post.date}</time>
              <span>·</span>
              <span>{post.readingTime} read</span>
            </div>
          </div>
          <h1 className={styles.postHeading}>{post.title}</h1>
          <p className={styles.summary}>{post.summary}</p>
          {post.tags.length > 0 && (
            <div className={styles.tags} aria-label="Tags">
              {post.tags.map((tag, i) => (
                <Link
                  key={tag}
                  href={`/blog?q=${encodeURIComponent(tag)}`}
                  className={styles.tagLink}
                  style={{ color: TAG_COLORS[i % TAG_COLORS.length] }}
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
          {post.image && post.imageWidth && post.imageHeight && (
            <figure className={styles.postHero}>
              <Image
                src={post.image}
                alt={post.imageAlt || post.title}
                width={post.imageWidth}
                height={post.imageHeight}
                sizes="(max-width: 720px) 100vw, 720px"
                priority
                className={styles.postHeroImage}
              />
              {post.imageCaption && (
                <figcaption className={styles.postHeroCaption}>
                  {post.imageCaption}
                </figcaption>
              )}
            </figure>
          )}
          <CopyAttribution
            url={`https://danoh.com/blog/${post.slug}`}
            className={styles.markdown}
          >
            <PostBody slug={post.slug} />
          </CopyAttribution>
          <EndOfFileCard post={post} />
          <RelatedPosts slug={post.slug} />
          <p className={styles.copyright}>
            © {postYear} {post.author} ·{" "}
            <a
              href={`https://danoh.com/blog/${post.slug}`}
              className={styles.copyrightLink}
            >
              danoh.com/blog/{post.slug}
            </a>
          </p>
          <div className={styles.footer}>
            <Link href="/blog" className={styles.footerLink}>
              ← All posts
            </Link>
            <span>
              <Link href="/privacy" className={styles.footerLink}>
                Privacy
              </Link>
              {" · "}
              <Link href="/" className={styles.footerLink}>
                Open the desktop<ExternalArrow />
              </Link>
            </span>
          </div>
        </article>
        <div className={`${styles.statusBar} ${styles.statusBarSticky}`}>
          <ReadingProgress />
          <span className={styles.statusCell}>{post.readingTime} read</span>
          <span className={styles.statusCell}>danoh.com</span>
        </div>
      </div>
      {/* Outside the shell: the wide-desktop Contents rail and the
        * floating back-to-top square. Route-page only, deliberately —
        * the in-OS Blog program scrolls an inner div where window-scroll
        * logic (and a fixed rail) would be wrong. */}
      <TocRail />
      <BackToTop />
    </div>
  );
}



// Per-tag / per-card accent colors, cycled deterministically. The
// Win98 16-color palette's three "document text" hues from the design.
const TAG_COLORS = ["#008080", "#000080", "#800000"];

// The post's closing card: reactions, sign-off, and the read-next
// actions that replaced the old prev/next grid. "Read next" prefers
// the newer neighbor and falls back to the older one, so the newest
// post still gets a destination.
function EndOfFileCard({ post }: { post: BlogPost }) {
  const { previous, next } = getAdjacentPosts(post.slug);
  const readNext = next ?? previous;
  return (
    <section className={styles.eofCard} aria-label="End of post">
      <div className={styles.eofTitleBar}>
        <span>End of file · {post.slug}.txt</span>
        <span className={styles.eofClose} aria-hidden="true">
          ×
        </span>
      </div>
      <div className={styles.eofBody}>
        <div className={styles.eofHeading}>How did this land?</div>
        <ReactionBar slug={post.slug} bare />
        <div className={styles.eofNote}>
          Enjoyed this? I write a few times a month, and I read every reply.
        </div>
        <div className={styles.eofActions}>
          {readNext && (
            <Link
              href={`/blog/${readNext.slug}`}
              className={`${styles.eofBtn} ${styles.eofBtnPrimary}`}
            >
              Read next: {readNext.title} →
            </Link>
          )}
          <a href="/feed.xml" className={styles.eofBtn}>
            Subscribe via RSS
          </a>
          <a href="mailto:hello@danoh.com" className={styles.eofBtn}>
            Say hello
          </a>
        </div>
      </div>
    </section>
  );
}

function RelatedPosts({ slug }: { slug: string }) {
  const related = getRelatedPosts(slug, 3);
  if (related.length === 0) return null;
  return (
    <aside className={styles.related} aria-label="Related posts">
      <div className={styles.relatedBlock}>
        <div className={styles.relatedTitle}>More from the blog</div>
        <ul className={styles.relatedList}>
          {related.map((p, i) => (
            <li key={p.slug} className={styles.relatedItem}>
              <Link href={`/blog/${p.slug}`} className={styles.relatedLink}>
                <CaptionIcon
                  className={styles.relatedIcon}
                  lineColor={TAG_COLORS[i % TAG_COLORS.length]}
                />
                <span className={styles.relatedText}>
                  <span className={styles.relatedItemTitle}>{p.title}</span>
                  <span className={styles.relatedItemSummary}>{p.summary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
