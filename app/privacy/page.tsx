import Link from "next/link";
import { buildMetadata } from "@/lib/buildMetadata";
import { ExternalArrow } from "@/components/ExternalArrow";
import { SkipLink } from "@/components/SkipLink";
import { PRIVACY_LAST_UPDATED } from "@/lib/legal";
import styles from "../blog/blog.module.css";

export const metadata = buildMetadata({
  title: "Privacy · Daniel Oh",
  description:
    "Exactly what danoh.com collects, why, and how to opt out. Plain language, no boilerplate.",
  url: "https://danoh.com/privacy",
});

// Intentionally short. A legal wall of text on a personal site is a
// signal that no one reads it — so I read it. If you want more detail
// on any of this, the Mail program is a click away. The "last updated"
// date lives in lib/legal.ts so the sitemap can't drift from it.

export default function Privacy() {
  return (
    <div className={styles.page}>
      <SkipLink />
      <div className={styles.shell}>
        <div className={styles.titleBar}>
          <div className={styles.titleBarText}>Privacy · danoh.com</div>
          <Link href="/" className={styles.titleBarLink}>
            Open the desktop<ExternalArrow />
          </Link>
        </div>
        <main id="main" className={styles.body}>
          <h1 className={styles.postHeading} style={{ fontSize: 22 }}>
            Privacy
          </h1>
          <p className={styles.indexSummary}>
            Here&apos;s exactly what this site stores, why, and how to opt out.
            No legal jargon. No dark patterns.
          </p>

          <Section title="What&rsquo;s stored in your browser">
            <ul>
              <li>
                <code>danoh_visitor</code> (localStorage + cookie): a random
                anonymous ID so reactions, the guestbook, visit count, and AI
                rate limits remember you across tabs. Not linked to anything
                identifying.
              </li>
              <li>
                Supabase session cookie: only set if you sign in with Google
                (there&rsquo;s no public reason to; sign-in is for me as the
                operator). Clears the moment you log off.
              </li>
            </ul>
          </Section>

          <Section title="Analytics">
            <ul>
              <li>
                <strong>Plausible</strong> (self-hosted): aggregate pageview
                counts. No cookies, no individual tracking.
              </li>
              <li>
                <strong>PostHog</strong>: event tracking (reactions, guestbook
                submits, AI endpoint usage, client errors). Uses cookies. You
                appear anonymous unless you log in, in which case events are
                attached to your Supabase user ID.
              </li>
            </ul>
            <p>
              Both exist so I can tell whether features are useful and whether
              something is silently broken. The easiest opt-out is the toggle
              in <strong>Settings &rarr; Analytics</strong>, which turns
              PostHog off for you on the spot. Plausible is cookieless and
              only counts aggregate pageviews, so there&rsquo;s nothing
              personal to opt out of; if you&rsquo;d rather block both at the
              network level, any standard ad blocker does it.
            </p>
          </Section>

          <Section title="Third parties that see your data">
            <ul>
              <li>
                <strong>Anthropic</strong>: prompts and responses when you use
                the Run, Chat, or Help programs.
              </li>
              <li>
                <strong>Supabase</strong>: my operator auth session. No
                visitor data unless you sign in.
              </li>
              <li>
                <strong>Resend</strong>: the contents of the Mail program form
                and the guestbook notification, to deliver email to me.
              </li>
              <li>
                <strong>Cloudflare</strong>: DNS + edge proxy; sees every
                request.
              </li>
            </ul>
          </Section>

          <Section title="What I don&rsquo;t do">
            <ul>
              <li>No ad networks or retargeting pixels.</li>
              <li>
                No selling your data. There is literally no commercial
                incentive for this site to move your information anywhere.
              </li>
              <li>
                No selling anything, currently. If paid tokens ever go live,
                Stripe handles checkout and never shares your card details
                with me.
              </li>
              <li>
                No reading guestbook messages to the public until they pass an
                AI moderation check. You can see the whole rule set in{" "}
                <code>app/api/guestbook/route.ts</code>.
              </li>
            </ul>
          </Section>

          <Section title="Your options">
            <ul>
              <li>
                Clear your <code>danoh_visitor</code> ID: DevTools &rarr;
                Application &rarr; Storage &rarr; Clear site data.
              </li>
              <li>
                Opt out of analytics: flip the toggle in{" "}
                <strong>Settings &rarr; Analytics</strong> (one click, no
                extensions). Or block the <code>plausible</code> and{" "}
                <code>posthog</code> domains at the network level. uBlock /
                Brave / Safari content blockers all do this by default.
              </li>
              <li>
                Delete a guestbook entry or request your data: open Mail and
                tell me. I&rsquo;ll handle it within a week.
              </li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              Questions, corrections, or deletion requests: open the Mail
              program on the desktop, or email{" "}
              <a href="mailto:hello@danoh.com">hello@danoh.com</a>
              .
            </p>
          </Section>

          <p className={styles.indexMeta} style={{ marginTop: 24 }}>
            Last updated {PRIVACY_LAST_UPDATED}
          </p>

          <div className={styles.footer}>
            <Link href="/" className={styles.footerLink}>
              ← Back to the desktop
            </Link>
            <span>
              <Link href="/terms" className={styles.footerLink}>
                Terms
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
