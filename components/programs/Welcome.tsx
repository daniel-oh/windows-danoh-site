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
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(entry.key); } }}
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
          <button onClick={openResume} style={{ cursor: "pointer", color: "#000080", textDecoration: "underline", background: "none", border: "none", font: "inherit", padding: 0, fontWeight: "bold" }}>Resume</button> and{" "}
          <button onClick={openBlog} style={{ cursor: "pointer", color: "#000080", textDecoration: "underline", background: "none", border: "none", font: "inherit", padding: 0, fontWeight: "bold" }}>Blog</button> are
          both here, or try generating your own app: hit <strong>Start &gt; Run</strong>,
          describe what you want, and the AI builds it in seconds.
        </p>
        <p style={{ fontSize: 11, color: "#555" }}>
          To try the AI, bring your own Anthropic API key in{" "}
          <button
            style={{ cursor: "pointer", color: "#000080", textDecoration: "underline", background: "none", border: "none", font: "inherit", padding: 0, fontWeight: "bold" }}
            onClick={() => createWindow({ title: "Settings", program: { type: "settings" } })}
          >Settings</button>,
          or{" "}
          <a href="https://www.linkedin.com/in/daniel-oh/" target="_blank" rel="noopener noreferrer" style={{ color: "#000080", textDecoration: "underline" }}>
            message me on LinkedIn
          </a>{" "}
          for an access code.
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
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openBlog()}
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
          Currently designing enterprise security strategy across 50+ AWS accounts at Nike.
          Before that, I built private network architectures at a fintech in New York,
          led cloud migrations for Fortune 100 clients, and deployed production
          systems at Allstate.
        </p>
        <p>
          I also run five ventures on the side. Michigan Engineering. Three Azure Expert certifications.
        </p>
        <div className={styles.buttonGroup} style={{ marginTop: 12 }}>
          <button onClick={openResume}>View Full Resume</button>
          <a href="/Daniel_Oh_Resume.pdf" download>
            Download PDF
          </a>
        </div>
      </>
    );
  },
  updates: () => {
    return (
      <>
        <h3>Updates</h3>

        <div style={{ borderLeft: "2px solid #808080", paddingLeft: 14, marginTop: 8 }}>
          <h4 style={{ margin: "0 0 4px" }}>Apr 13, 2026</h4>
          <p style={{ margin: "0 0 4px", fontWeight: "bold" }}>danoh.com goes live</p>
          <p style={{ margin: "0 0 12px" }}>
            Launched this site. A static portfolio felt too predictable, so I built a retro
            desktop that generates real apps with AI. The whole thing runs on Next.js 16,
            Claude Sonnet 4.6, and a single Docker container.
          </p>

          <h4 style={{ margin: "0 0 4px" }}>Apr 11, 2026</h4>
          <p style={{ margin: "0 0 4px", fontWeight: "bold" }}>Fix and Iterate ships</p>
          <p style={{ margin: "0 0 12px" }}>
            Click the <code>?</code> on any generated app to talk to the AI that built it.
            Describe a bug, request a feature, and the app updates live. No reload, no copy-paste.
          </p>

          <h4 style={{ margin: "0 0 4px" }}>Apr 10, 2026</h4>
          <p style={{ margin: "0 0 4px", fontWeight: "bold" }}>Mobile, security, and polish</p>
          <p style={{ margin: "0 0 12px" }}>
            Full touch support for phones and tablets. Sandboxed iframes, rate limiting,
            prompt injection protections, and constant-time auth. Desktop icons snap to grid
            and drag to rearrange.
          </p>

          <h4 style={{ margin: "0 0 4px" }}>Apr 9, 2026</h4>
          <p style={{ margin: "0 0 4px", fontWeight: "bold" }}>First commit</p>
          <p style={{ margin: "0 0 4px" }}>
            Forked{" "}
            <a href="https://github.com/SawyerHood/windows9x" target="_blank" rel="noopener noreferrer" style={{ color: "#000080", textDecoration: "underline" }}>
              windows9x
            </a>{" "}
            by Sawyer Hood. Upgraded to Next.js 16, React 19, swapped in the Anthropic SDK,
            and started building.
          </p>
        </div>
      </>
    );
  },
  advanced: () => {
    return (
      <>
        <h3>Advanced</h3>
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
        <p style={{ fontSize: 11, color: "#555", marginTop: 8, borderTop: "1px solid #ccc", paddingTop: 8 }}>
          <strong>Privacy:</strong> All files are stored in your browser&apos;s
          local storage. Nothing is sent to the server. You can optionally mount
          a local directory in Settings, but that stays on your machine too.
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
        src="/danoh-logo-animated.gif"
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
