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
  const ogImages = post.image
    ? [{ url: post.image, alt: post.imageAlt || post.title }]
    : undefined;
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

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    author: { "@type": "Person", name: post.author },
    keywords: post.tags.join(", "),
    url: `https://danoh.com/blog/${post.slug}`,
    mainEntityOfPage: `https://danoh.com/blog/${post.slug}`,
    publisher: {
      "@type": "Person",
      name: post.author,
      url: "https://danoh.com",
    },
  };

  return (
    <div className={styles.page}>
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
        <article className={styles.body}>
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
