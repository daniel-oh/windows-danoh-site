"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "./Welcome.module.css";
import check from "@/components/assets/check.png";
import { sortedPosts } from "@/content/blog/posts";
import { createWindow } from "@/lib/createWindow";

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
      <h4 className={styles.sidebarTitle}>Contents</h4>
      <ul className={styles.sidebarList}>
        {entries.map((entry) => {
          return (
            <li
              key={entry.key}
              onClick={() => onSelect(entry.key)}
              className={entry.key === selectedEntry ? styles.selected : ""}
            >
              <span>{entry.title}</span>
              {entry.key === selectedEntry && (
                <Image src={check} alt="Selected" width={16} height={16} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const openBlog = () => {
  createWindow({
    title: "Blog",
    program: { type: "blog" },
    size: { width: 700, height: 500 },
  });
};

const openResume = () => {
  createWindow({
    title: "Resume - Daniel Oh",
    program: { type: "resume" },
    size: { width: 700, height: 550 },
  });
};

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
            <h3>Hey, I&apos;m Daniel Oh</h3>
            <p>
              Platform engineer at Nike. Michigan Engineering alum. I build
              infrastructure that teams ship on, and side projects that keep
              me learning. Thanks for stopping by.
            </p>
          </div>
        </div>
        <p>
          Poke around the desktop. My{" "}
          <strong style={{ cursor: "pointer", color: "#000080", textDecoration: "underline" }} onClick={openResume}>Resume</strong> and{" "}
          <strong style={{ cursor: "pointer", color: "#000080", textDecoration: "underline" }} onClick={openBlog}>Blog</strong> are
          both here, or try generating your own app: hit <strong>Start &gt; Run</strong>,
          describe what you want, and the AI builds it in seconds.
        </p>
        <div className={styles.buttonGroup}>
          <a
            href="https://github.com/daniel-oh/windows-danoh-site"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button>GitHub</button>
          </a>
          <a
            href="https://www.linkedin.com/in/daniel-oh/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <button>LinkedIn</button>
          </a>
          <button onClick={openResume}>Resume</button>
        </div>
      </>
    );
  },
  blog: () => {
    const recentPosts = sortedPosts.slice(0, 5);
    return (
      <>
        <h3>Blog</h3>
        <p>
          Read the latest from Daniel Oh.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "12px 0", maxHeight: 300, overflowY: "auto" }}>
          {recentPosts.map((post) => (
            <div
              key={post.slug}
              style={{
                padding: "8px 10px",
                background: "#dfdfdf",
                border: "1px solid #808080",
                cursor: "pointer",
                flexShrink: 0,
              }}
              onClick={openBlog}
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
                color: "#555",
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {post.date} &middot; {post.author} &middot; {post.summary}
              </div>
            </div>
          ))}
        </div>
        <button onClick={openBlog}>
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
            <h3 style={{ margin: 0 }}>Daniel Oh</h3>
            <div style={{ fontSize: 11, color: "#555" }}>
              Sr. Platform Engineer at Nike &middot; Chicago, IL
            </div>
          </div>
        </div>
        <p>
          Platform engineering and cybersecurity at Nike. Previously Capital Markets Gateway,
          Avanade, and Allstate. Michigan Engineering. Three Azure Expert certifications.
          Five ventures on the side.
        </p>
        <p>
          <strong>Core skills:</strong> Kubernetes, Terraform, AWS/Azure/GCP, GitHub Actions, GitOps,
          security compliance, and developer platforms.
        </p>
        <div className={styles.buttonGroup} style={{ marginTop: 12 }}>
          <button onClick={openResume}>View Full Resume</button>
          <a href="/Daniel_Oh_Resume.pdf" download>
            <button>Download PDF</button>
          </a>
        </div>
      </>
    );
  },
  updates: () => {
    return (
      <>
        <h3>Updates</h3>

        <h4>April 2026 - Launch</h4>
        <p>
          danoh.com is live. Built this personal site as a retro AI-powered desktop
          because a static portfolio felt too boring. Here&apos;s what shipped:
        </p>
        <ul>
          <li><strong>AI App Generator</strong>: Describe any app in the Run dialog and it gets built on the fly using Claude Sonnet 4.6. Paint apps, calculators, games, whatever you can imagine.</li>
          <li><strong>Fix &amp; Iterate</strong>: Click the <code>?</code> button on any generated app to chat with the AI. Report bugs, request features. The app updates live.</li>
          <li><strong>Blog</strong>: Built-in blog reader right on the desktop. Posts are written in TypeScript, no CMS needed.</li>
          <li><strong>Resume</strong>: Interactive resume with PDF download, viewable right in the OS.</li>
          <li><strong>Mobile-friendly</strong>: Full touch support: tap to open, drag to rearrange icons, responsive windows.</li>
          <li><strong>Security hardened</strong>: Access code gate, rate limiting, sandboxed iframes, prompt injection protections, constant-time auth.</li>
        </ul>

        <h4>Tech Stack</h4>
        <ul>
          <li>Next.js 16 + React 19 + TypeScript</li>
          <li>Anthropic Claude API (Sonnet 4.6 for generation, Haiku for lightweight tasks)</li>
          <li>PostgreSQL for session management and program persistence</li>
          <li>Docker + Traefik + Watchtower for deployment</li>
          <li>98.css for the authentic Windows 98 aesthetic</li>
        </ul>

        <p>
          Open source under AGPL-3.0. Built on{" "}
          <a href="https://github.com/SawyerHood/windows9x" target="_blank" rel="noopener noreferrer" style={{ color: "#000080", textDecoration: "underline" }}>
            windows9x
          </a>{" "}
          by Sawyer Hood.
        </p>
      </>
    );
  },
  advanced: () => {
    return (
      <>
        <h3>Advanced</h3>
        <p>
          Everything in this OS is a file. Open <strong>Explorer</strong> from
          the Start menu to browse the filesystem. Generated apps can read, write,
          and save files too.
        </p>
        <p>
          Generated programs also have access to a few built-in OS APIs:
        </p>
        <ul>
          <li><strong>Files</strong>: Open and save files to persist app state</li>
          <li><strong>Registry</strong>: Store settings across programs</li>
          <li><strong>Chat</strong>: Let your generated app call an LLM directly</li>
        </ul>
        <p>
          Try mentioning these when describing an app in the Run dialog.
          For example: &quot;a note-taking app that saves to the filesystem&quot;
          or &quot;a trivia game that uses chat to generate questions.&quot;
        </p>
      </>
    );
  },
};

export const WIDTH = 700;

export function Welcome({ id: _id }: { id: string }) {
  const tableOfContentsEntries: TableOfContentsEntry[] = [
    { title: "Welcome", key: "welcome" },
    { title: "Blog", key: "blog" },
    { title: "Resume", key: "resume" },
    { title: "Updates", key: "updates" },
    { title: "Advanced", key: "advanced" },
  ];

  const [selectedEntry, setSelectedEntry] = useState(() => {
    if (typeof window !== "undefined") {
      const onboarded = localStorage.getItem("onboarded");
      return onboarded ? "blog" : "welcome";
    }
    return "welcome";
  });

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("onboarded")) {
      localStorage.setItem("onboarded", "true");
    }
  }, []);

  const handleEntrySelect = (key: string) => {
    setSelectedEntry(key);
  };

  const Content = contentByKey[selectedEntry as keyof typeof contentByKey];

  return (
    <div className={styles.welcomeContainer}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lootrunners_logo.gif"
        alt="DanOh"
        className={styles.animatedLogo}
      />
      <div className={styles.contentWrapper}>
        <TableOfContents
          entries={tableOfContentsEntries}
          selectedEntry={selectedEntry}
          onSelect={handleEntrySelect}
        />
        <div className={styles.mainContent}>
          {Content ? <Content /> : <p>No content for this section.</p>}
        </div>
      </div>
    </div>
  );
}
