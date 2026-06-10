import Link from "next/link";
import { buildMetadata } from "@/lib/buildMetadata";
import { ExternalArrow } from "@/components/ExternalArrow";
import { SkipLink } from "@/components/SkipLink";
import { TERMS_LAST_UPDATED } from "@/lib/legal";
import styles from "../blog/blog.module.css";

export const metadata = buildMetadata({
  title: "Terms · Daniel Oh",
  description:
    "The short version of how danoh.com works: generated apps come as-is, use it in good faith, and what you post is yours.",
  url: "https://danoh.com/terms",
});

// Same stance as /privacy: a personal site doesn't need a contract
// nobody reads. This is the handful of things that actually matter,
// in plain language. The "last updated" date lives in lib/legal.ts so
// the sitemap can't drift from it.

export default function Terms() {
  return (
    <div className={styles.page}>
      <SkipLink />
      <div className={styles.shell}>
        <div className={styles.titleBar}>
          <div className={styles.titleBarText}>Terms · danoh.com</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        <main id="main" className={styles.body}>
          <h1 className={styles.postHeading} style={{ fontSize: 22 }}>
            Terms of use
          </h1>
          <p className={styles.indexSummary}>
            danoh.com is a personal project, not a product with a support
            desk. Here&apos;s the short version of how it works, in the same
            plain language as the{" "}
            <Link href="/privacy" style={{ color: "#000080" }}>
              privacy page
            </Link>
            .
          </p>

          <Section title="The apps are generated, not guaranteed">
            <p>
              When you describe an app, an AI writes it on the spot and runs
              it in a sandboxed frame in your browser. It&rsquo;s a demo of
              what&rsquo;s possible, not production software. It might be
              buggy, do something unexpected, or not work at all. Don&rsquo;t
              rely on a generated app for anything that matters, and
              don&rsquo;t paste secrets into one. It runs on your machine, at
              your discretion.
            </p>
          </Section>

          <Section title="Use it in good faith">
            <ul>
              <li>
                Don&rsquo;t use the generator, guestbook, or contact form for
                anything illegal, abusive, hateful, or aimed at harming
                someone else.
              </li>
              <li>
                Don&rsquo;t try to break out of the sandbox, hammer the AI
                endpoints, or use the site to attack other systems.
              </li>
              <li>
                The guestbook passes through an AI moderation check before
                anything appears. I can also remove anything, anytime, for any
                reason.
              </li>
            </ul>
          </Section>

          <Section title="What you make and post">
            <p>
              What you type stays yours. By posting to the guestbook you
              &rsquo;re letting me display it on the site; that&rsquo;s the
              only license you grant, and you can ask me to take it down. Code
              an AI generates from your prompt is yours to use as you see
              fit. It runs entirely in your browser and I don&rsquo;t keep a
              claim on it.
            </p>
          </Section>

          <Section title="No warranty, no liability">
            <p>
              The site is provided as-is, with no warranty of any kind. It
              might break, change, or disappear without notice. I&rsquo;m not
              liable for anything that happens from using it or from running an
              app it generated. If a feature ever costs money, that&rsquo;ll
              be spelled out clearly before you pay. Nothing here bills you by
              surprise.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              I may update these terms as the site grows. The date below is
              the last time they meaningfully changed. Nothing here is a
              substitute for legal advice; it&rsquo;s an honest description of
              how a personal site operates.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about any of this: open the Mail program on the
              desktop, or email{" "}
              <a href="mailto:hello@danoh.com">hello@danoh.com</a>.
            </p>
          </Section>

          <p className={styles.indexMeta} style={{ marginTop: 24 }}>
            Last updated {TERMS_LAST_UPDATED}
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
              <Link href="/blog" className={styles.footerLink}>
                Blog<ExternalArrow />
              </Link>
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.privacySection}>
      <h2 className={styles.privacySectionHeading}>{title}</h2>
      <div className={styles.privacySectionBody}>{children}</div>
    </section>
  );
}
