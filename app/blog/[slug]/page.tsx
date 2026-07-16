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
      authors: [post.author],
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
      <div className={styles.shell}>
        <div className={styles.titleBar}>
          <CaptionIcon />
          <div className={styles.titleBarText}>{post.title} · danoh.com</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        <article id="main" className={styles.body}>
          <div className={styles.meta}>
            <time dateTime={post.date}>{post.date}</time>
            <span>·</span>
            <span>{post.author}</span>
            <span>·</span>
            <span>{post.readingTime} read</span>
          </div>
          <h1 className={styles.postHeading}>{post.title}</h1>
          <p className={styles.summary}>{post.summary}</p>
          {post.tags.length > 0 && (
            <div className={styles.tags} aria-label="Tags">
              {post.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
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
          <ReactionBar slug={post.slug} />
          <div className={styles.postCta}>
            Enjoyed this? I write a few times a month. Follow along via{" "}
            <a href="/feed.xml" className={styles.footerLink}>
              RSS
            </a>
            , or just say hello:{" "}
            <a href="mailto:hello@danoh.com" className={styles.footerLink}>
              hello@danoh.com
            </a>
            .
          </div>
          <RelatedAndAdjacent slug={post.slug} />
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
        <div className={styles.statusBar}>
          <span className={`${styles.statusCell} ${styles.grow}`}>
            {post.readingTime} read
          </span>
          <span className={styles.statusCell}>danoh.com</span>
        </div>
      </div>
    </div>
  );
}



function RelatedAndAdjacent({ slug }: { slug: string }) {
  const related = getRelatedPosts(slug, 3);
  const { previous, next } = getAdjacentPosts(slug);
  if (related.length === 0 && !previous && !next) return null;
  return (
    <aside className={styles.related} aria-label="Related posts">
      {related.length > 0 && (
        <div className={styles.relatedBlock}>
          <div className={styles.relatedTitle}>More from the blog</div>
          <ul className={styles.relatedList}>
            {related.map((p) => (
              <li key={p.slug} className={styles.relatedItem}>
                <Link
                  href={`/blog/${p.slug}`}
                  className={styles.relatedLink}
                >
                  <div className={styles.relatedItemTitle}>{p.title}</div>
                  <div className={styles.relatedItemSummary}>{p.summary}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(previous || next) && (
        <nav className={styles.adjacent} aria-label="Previous and next posts">
          {previous ? (
            <Link href={`/blog/${previous.slug}`} className={styles.adjLink}>
              <span className={styles.adjLabel}>← Previous</span>
              <span className={styles.adjTitle}>{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/blog/${next.slug}`}
              className={`${styles.adjLink} ${styles.adjNext}`}
            >
              <span className={styles.adjLabel}>Next →</span>
              <span className={styles.adjTitle}>{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </aside>
  );
}
