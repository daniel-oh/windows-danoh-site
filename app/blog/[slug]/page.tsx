import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  sortedPosts,
  getAdjacentPosts,
  getRelatedPosts,
  type BlogPost,
} from "@/content/blog/posts";
import { getPostComponent } from "@/content/blog/posts-content";
import { CopyAttribution } from "@/components/CopyAttribution";
import { ExternalArrow } from "@/components/ExternalArrow";
import { SkipLink } from "@/components/SkipLink";
import styles from "../blog.module.css";

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
  // Fall back to the site-wide OG image when a post hasn't set its
  // own. Without this, posts without an explicit hero would render
  // with no preview card on X / LinkedIn / Slack — a blank placeholder
  // where the danoh.com card should be.
  const ogImages = post.image
    ? [{ url: post.image, alt: post.imageAlt || post.title }]
    : [{ url: "/og-image.png", width: 1200, height: 630, alt: "Daniel Oh" }];
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
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
      images: post.image ? [post.image] : undefined,
    },
  };
}

export default async function Post({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

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
    author: authorPerson,
    keywords: post.tags.join(", "),
    url: `https://danoh.com/blog/${post.slug}`,
    mainEntityOfPage: `https://danoh.com/blog/${post.slug}`,
    publisher: authorPerson,
    copyrightHolder: authorPerson,
    copyrightYear: postYear,
    // CC-style implicit terms: byline + canonical link required on
    // reposts; we treat the CopyAttribution snippet as the
    // machine-readable expression of the same.
    creditText: `${post.author} · danoh.com/blog/${post.slug}`,
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
          <div className={styles.titleBarText}>{post.title} · danoh.com</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        <article id="main" className={styles.body}>
          <div className={styles.meta}>
            <span>{post.date}</span>
            <span>·</span>
            <span>{post.author}</span>
          </div>
          <h1 className={styles.postHeading}>{post.title}</h1>
          <p className={styles.summary}>{post.summary}</p>
          {post.tags.length > 0 && (
            <div className={styles.tags}>
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
            <Link href="/" className={styles.footerLink}>
              Open the desktop<ExternalArrow />
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}

function PostBody({ slug }: { slug: string }) {
  const Component = getPostComponent(slug);
  if (!Component) return <p>Post content not found.</p>;
  return <Component />;
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
