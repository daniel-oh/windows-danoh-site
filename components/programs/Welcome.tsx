"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Welcome.module.css";
import { Odometer } from "../Odometer";
import check from "@/components/assets/check.png";
import { newestPosts } from "@/content/blog/posts";
import { createWindow } from "@/lib/createWindow";
import { openProgram, PROGRAMS } from "@/lib/programs";
import { useVisitorCount } from "@/lib/useVisitorCount";

type TableOfContentsEntry = {
  title: string;
  key: string;
};

type TableOfContentsProps = {
  entries: TableOfContentsEntry[];
  selectedEntry: string;
  onSelect: (key: string) => void;
};

const TableOfContents: React.FC<TableOfContentsProps> = ({
  entries,
  selectedEntry,
  onSelect,
}) => {
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarTitle} role="heading" aria-level={2}>Contents</div>
      <ul className={styles.sidebarList}>
        {entries.map((entry) => {
          return (
            // A real <button> inside the <li>: role="button" on the <li>
            // itself is invalid inside a list, and the native element gives
            // Enter/Space, focus and the accessible name for free.
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => onSelect(entry.key)}
                className={`${styles.sidebarItem} ${entry.key === selectedEntry ? styles.selected : ""}`}
                aria-current={entry.key === selectedEntry ? "true" : undefined}
              >
                <span>{entry.title}</span>
                {entry.key === selectedEntry && (
                  // Decorative: aria-current already says which row is selected.
                  <Image src={check} alt="" width={16} height={16} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <SidebarLogo />
      <div className={styles.sidebarCounter}>
        <VisitorBadge />
      </div>
    </div>
  );
};

// The looping logo: WCAG 2.2.2 wants auto-playing motion >5s to be
// stoppable; reduced-motion users get the static poster, and the
// video itself is click-to-pause for everyone else.
const SidebarLogo = () => {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={styles.sidebarLogo}
        src="/danoh-logo-poster.png"
        alt=""
      />
    );
  }
  return <LoopingLogo />;
};

// An 8 second loop, so WCAG 2.2.2 needs a way to stop it that works for
// everyone. It used to be a click on an aria-hidden, unfocusable video:
// no keyboard, no screen reader. Now the video sits in a real button.
const LoopingLogo = () => {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const label = playing ? "Pause the logo animation" : "Play the logo animation";
  return (
    <button
      type="button"
      className={styles.logoButton}
      aria-label={label}
      title={label}
      onClick={() => {
        const v = ref.current;
        if (!v) return;
        if (v.paused) void v.play();
        else v.pause();
      }}
    >
      <video
        ref={ref}
        className={styles.sidebarLogo}
        poster="/danoh-logo-poster.png"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src="/danoh-logo-animated.webm" type="video/webm" />
        <source src="/danoh-logo-animated.mp4" type="video/mp4" />
      </video>
    </button>
  );
};

// The Welcome window's changelog, newest first.
const UPDATES: { date: string; title: string; body: React.ReactNode }[] = [
  {
    date: "Sep 22, 2026",
    title: "Sampler",
    body: (
      <>
        Sixteen pads, a Rust audio engine and a 12-bit switch. Record
        through your mic, loop a bar, and export a WAV that opens from
        Explorer. How it keeps time:{" "}
        <Link href="/blog/audio-thread" style={{ color: "#000080", textDecoration: "underline" }}>Building a sampler with 2.7 milliseconds to spare</Link>.
      </>
    ),
  },
  {
    date: "Sep 18, 2026",
    title: "Camera and Glass",
    body: (
      <>
        A 1998 webcam that saves chunky, sixteen-colour snaps to My
        Pictures, all in your browser, and Glass, a pane of liquid glass.
        The error pages now glitch like a broken display.
      </>
    ),
  },
  {
    date: "Sep 17, 2026",
    title: "Sonnet 5, and a background remover",
    body: (
      <>
        Generated apps now run on Claude Sonnet 5, better and cheaper. New
        post: <Link href="/blog/background-remover" style={{ color: "#000080", textDecoration: "underline" }}>4 GB to 76 MB, open-sourcing Kayrage&apos;s background remover</Link>.
      </>
    ),
  },
  {
    date: "Jul 16, 2026",
    title: "The blog becomes a Win98 window",
    body: <>The blog and every post were redesigned as Explorer and document windows, with a real resume page to match.</>,
  },
  {
    date: "Jun 10, 2026",
    title: "Boot screen, 3D Pipes, genie windows",
    body: (
      <>
        Each session boots from a BIOS screen, 3D Pipes takes over when
        you go idle, and windows genie into the taskbar. Built with
        Claude&apos;s Fable 5: <Link href="/blog/letting-fable-5-loose" style={{ color: "#000080", textDecoration: "underline" }}>field notes</Link>.
      </>
    ),
  },
  {
    date: "May 11, 2026",
    title: "Privacy page and cost guardrails",
    body: <>A plain-language privacy page, a contact form that really sends, and spending caps on every AI endpoint.</>,
  },
  {
    date: "Apr 17, 2026",
    title: "MDX blog and four new programs",
    body: <>Posts can embed live React. Minesweeper, an AI-moderated Guestbook, Mail and a Recycle Bin arrived.</>,
  },
  {
    date: "Apr 13, 2026",
    title: "danoh.com goes live",
    body: <>A retro desktop that builds real apps with AI, instead of a static portfolio.</>,
  },
  {
    date: "Apr 11, 2026",
    title: "Fix & Iterate",
    body: (
      <>
        Click the <code>?</code> on any generated app, describe a bug or a
        feature, and the app updates live.
      </>
    ),
  },
  {
    date: "Apr 9, 2026",
    title: "First commit",
    body: (
      <>
        Forked{" "}
        <a
          href="https://github.com/SawyerHood/windows9x"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#000080", textDecoration: "underline" }}
        >
          windows9x
        </a>{" "}
        by Sawyer Hood and started building.
      </>
    ),
  },
];

const openBlog = (slug?: string) => {
  // Spread the shared Blog config (title/size) and override just the
  // program so the clicked post threads through — without initialSlug
  // every recent-posts row opened the newest post.
  createWindow({
    ...PROGRAMS.blog,
    program: { type: "blog", initialSlug: slug },
  });
};

const openResume = () => openProgram("resume");

const contentByKey = {
  welcome: () => {
    return (
      <>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/headshot.jpg"
            alt="Daniel Oh"
            style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
              border: "2px solid #808080",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            {/* The page's h1 lives here: the desktop has no other heading,
                and crawlers index the rendered DOM. Styled to match the
                old h3 so nothing shifts visually. */}
            <h1 style={{ marginBottom: 4, fontSize: "1.17em", fontWeight: "bold" }}>
              Hey, I&apos;m Daniel Oh
            </h1>
            <p style={{ margin: "0 0 8px 0" }}>
              Engineer, maker, and curious person. I care about how things
              work, how they feel, and the people who use them. Thanks for
              stopping by.
            </p>
          </div>
        </div>
        <p>
          Poke around the desktop. My{" "}
          <a href="/Daniel_Oh_Resume.pdf" onClick={(e) => { e.preventDefault(); openResume(); }} style={{ color: "#000080" }}><strong>Resume</strong></a> and{" "}
          <Link href="/blog" onClick={(e) => { e.preventDefault(); openBlog(); }} style={{ color: "#000080" }}><strong>Blog</strong></Link> are
          both here, or try generating your own app: hit <strong>Start &gt; Run</strong>,
          describe what you want, and the AI builds it in seconds.
        </p>
        <p style={{ fontSize: 11, color: "#444" }}>
          To try the AI, bring your own Anthropic API key in{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); openProgram("settings"); }} style={{ color: "#000080" }}><strong>Settings</strong></a>,
          or{" "}
          <a href="https://www.linkedin.com/in/daniel-oh/" target="_blank" rel="noopener noreferrer" style={{ color: "#000080", textDecoration: "underline" }}>
            message me on LinkedIn
          </a>{" "}
          for an access code.
        </p>
        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={() =>
              window.open(
                "https://github.com/daniel-oh/windows-danoh-site",
                "_blank",
                "noopener,noreferrer"
              )
            }
          >
            GitHub
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(
                "https://www.linkedin.com/in/daniel-oh/",
                "_blank",
                "noopener,noreferrer"
              )
            }
          >
            LinkedIn
          </button>
          <button onClick={openResume}>Resume</button>
          <button
            type="button"
            onClick={() => openProgram("mail")}
          >
            Email me
          </button>
        </div>
      </>
    );
  },
  blog: () => {
    const recentPosts = newestPosts.slice(0, 5);
    return (
      <>
        <header style={{ marginBottom: 0 }}>
          <h2 style={{ margin: 0, lineHeight: 1.1, fontSize: "1.25rem" }}>Blog</h2>
          <p
            style={{
              margin: "2px 0 0 0",
              fontSize: 13,
              fontStyle: "italic",
              color: "#444",
              lineHeight: 1.35,
            }}
          >
            Design, craft, and the work of building things that last.
          </p>
        </header>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "8px 0 10px", maxHeight: 300, overflowY: "auto" }}>
          {recentPosts.map((post) => (
            // Real anchors with deep links: these rows are the rendered
            // DOM's only path to the posts, so crawlers need the hrefs;
            // preventDefault keeps the in-OS reading experience.
            <a
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{
                padding: "8px 10px",
                background: "#dfdfdf",
                border: "1px solid #808080",
                cursor: "pointer",
                flexShrink: 0,
                display: "block",
                color: "inherit",
                textDecoration: "none",
              }}
              onClick={(e) => {
                e.preventDefault();
                openBlog(post.slug);
              }}
            >
              <div style={{
                fontWeight: "bold",
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>{post.title}</div>
              <div style={{
                fontSize: 11,
                color: "#444",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {post.date} &middot; {post.author} &middot; {post.summary}
              </div>
            </a>
          ))}
        </div>
        <button onClick={() => openBlog()}>
          Open Blog
        </button>
      </>
    );
  },
  resume: () => {
    return (
      <>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/headshot-resume.jpg"
            alt="Daniel Oh"
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              border: "2px solid #808080",
              objectFit: "cover",
            }}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Daniel Oh</h2>
            <div style={{ fontSize: 11, color: "#444" }}>
              Sr. Platform Engineer at Nike &middot; Chicago, IL
            </div>
          </div>
        </div>
        <p>
          Currently designing enterprise security strategy across 50+ AWS accounts at Nike.
          Before that, I built private network architectures at a fintech startup in New York,
          led cloud migrations for Fortune 100 clients, and deployed production
          systems at Allstate.
        </p>
        <p>
          I also build things on the side. Michigan Engineering. Three Azure Expert certifications.
        </p>
        <div className={styles.buttonGroup} style={{ marginTop: 12 }}>
          <button onClick={openResume}>View Full Resume</button>
          {/* Programmatic download via a transient anchor click — the
           * previous <button> nested inside <a download> was invalid
           * HTML and the inner button intercepted the anchor's
           * download attribute on some browsers. */}
          <button
            type="button"
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/Daniel_Oh_Resume.pdf";
              a.download = "Daniel_Oh_Resume.pdf";
              a.rel = "noopener";
              document.body.appendChild(a);
              a.click();
              a.remove();
            }}
          >
            Download PDF
          </button>
        </div>
      </>
    );
  },
  updates: () => {
    return (
      <>
        <h2 style={{ fontSize: "1.25rem" }}>Updates</h2>

        {/* Short on purpose: one or two lines per entry, only what a
            visitor would find interesting. Dates are the day it shipped. */}
        <div style={{ borderLeft: "2px solid #808080", paddingLeft: 14, marginTop: 8 }}>
          {UPDATES.map((u) => (
            <div key={u.date} style={{ marginBottom: 12 }}>
              <h3 style={{ margin: "0 0 2px", fontSize: "1rem" }}>{u.date}</h3>
              <p style={{ margin: "0 0 2px", fontWeight: "bold" }}>{u.title}</p>
              <p style={{ margin: 0 }}>{u.body}</p>
            </div>
          ))}
        </div>
      </>
    );
  },
  advanced: () => {
    return (
      <>
        <h2 style={{ fontSize: "1.25rem" }}>Advanced</h2>
        <p>
          Everything here is a file. Open <strong>Explorer</strong> to browse.
          Generated apps can read, write, and save files too.
        </p>
        <p><strong>OS APIs for generated apps:</strong></p>
        <ul>
          <li><strong>Files</strong>: Persist app state across sessions</li>
          <li><strong>Registry</strong>: Shared settings across programs</li>
          <li><strong>Chat</strong>: Call an LLM from inside your app</li>
        </ul>
        <p>
          Mention these when generating: &quot;a notes app that saves files&quot;
          or &quot;a trivia game that generates questions with chat.&quot;
        </p>
        <p style={{ fontSize: 11, color: "#444", marginTop: 8, borderTop: "1px solid #ccc", paddingTop: 8 }}>
          <strong>Privacy:</strong> All files are stored in your browser&apos;s
          local storage. Nothing is sent to the server. You can optionally mount
          a local directory in Settings, but that stays on your machine too.
          This site uses cookie-free, privacy-friendly{" "}
          <a href="https://plausible.io" target="_blank" rel="noopener noreferrer" style={{ color: "#000080", textDecoration: "underline" }}>analytics</a>.
          No personal data is collected.
        </p>
      </>
    );
  },
};

function VisitorBadge() {
  const total = useVisitorCount();
  // Defer render until we have a number — avoids flashing "#null"
  if (total === null) return null;
  return (
    <div
      style={{
        display: "inline-block",
        marginTop: 4,
        padding: "2px 8px",
        fontSize: 10,
        background: "#000",
        color: "#00ff66",
        fontFamily: "monospace",
        border: "1px solid #555",
        letterSpacing: 0.5,
      }}
      aria-label={`You are visitor number ${total}`}
      title="Unique visitors since this site went live"
    >
      you are visitor #<Odometer value={total} />
    </div>
  );
}

export function Welcome({ id: _id }: { id: string }) {
  const tableOfContentsEntries: TableOfContentsEntry[] = [
    { title: "Welcome", key: "welcome" },
    { title: "Blog", key: "blog" },
    { title: "Resume", key: "resume" },
    { title: "Updates", key: "updates" },
    { title: "Advanced", key: "advanced" },
  ];

  // Storage can throw (Safari "Block all cookies", some private modes);
  // Welcome opens at boot, so an unguarded read here broke the desktop.
  const [selectedEntry, setSelectedEntry] = useState(() => {
    try {
      return localStorage.getItem("onboarded") ? "blog" : "welcome";
    } catch {
      return "welcome";
    }
  });

  useEffect(() => {
    try {
      if (!localStorage.getItem("onboarded")) localStorage.setItem("onboarded", "true");
    } catch {
      // Not remembering the first visit is fine.
    }
  }, []);

  const handleEntrySelect = (key: string) => {
    setSelectedEntry(key);
  };

  const Content = contentByKey[selectedEntry as keyof typeof contentByKey];

  return (
    <div className={styles.welcomeContainer}>
      <div className={styles.contentWrapper}>
        <TableOfContents
          entries={tableOfContentsEntries}
          selectedEntry={selectedEntry}
          onSelect={handleEntrySelect}
        />
        <div className={styles.mainContent}>
          {/* The Welcome tab carries the page's visible h1. Returning
              visitors open on another tab, which left the page with no h1
              and starting at a lower heading. */}
          {selectedEntry !== "welcome" && (
            <h1 className={styles.srOnly}>Daniel Oh, danoh.com</h1>
          )}
          {Content ? <Content /> : <p>No content for this section.</p>}
        </div>
      </div>
    </div>
  );
}
