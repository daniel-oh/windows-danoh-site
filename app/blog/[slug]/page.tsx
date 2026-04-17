import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Markdown from "react-markdown";
import { sortedPosts, type BlogPost } from "@/content/blog/posts";
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
  if (!post) return { title: "Post not found — Daniel Oh" };
  const url = `https://danoh.com/blog/${post.slug}`;
  return {
    title: `${post.title} — Daniel Oh`,
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
      title: post.title,
      description: post.summary,
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
          <div className={styles.titleBarText}>{post.title} — danoh.com</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop ↗
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
          <div className={styles.markdown}>
            <Markdown>{post.content}</Markdown>
          </div>
          <div className={styles.footer}>
            <Link href="/blog" className={styles.footerLink}>
              ← All posts
            </Link>
            <Link href="/" className={styles.footerLink}>
              Open the desktop ↗
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
