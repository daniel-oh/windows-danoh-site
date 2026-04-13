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
    title: "Resume — Daniel Oh",
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
              Sr. Platform Engineer at Nike, University of Michigan Computer Engineering grad,
              and builder of things. Welcome to my personal corner of the internet —
              a retro AI-powered desktop where you can explore my work, read my blog,
              and even generate your own apps.
            </p>
          </div>
        </div>
        <p>
          Check out my <strong style={{ cursor: "pointer", color: "#000080", textDecoration: "underline" }} onClick={openResume}>Resume</strong> to
          see my experience, or browse the <strong style={{ cursor: "pointer", color: "#000080", textDecoration: "underline" }} onClick={openBlog}>Blog</strong> for
          what I&apos;m working on.
        </p>
        <p>
          Want to try the AI? Press <strong>Start &gt; Run</strong> and describe any app —
          DanOh will create it for you on the fly.
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
          8+ years in platform engineering, cybersecurity, and DevOps across Nike, Capital Markets Gateway,
          Avanade, and Allstate. University of Michigan Computer Engineering. Three Azure Expert certifications.
          Five ventures on the side.
        </p>
        <p>
          <strong>Core expertise:</strong> Kubernetes, Terraform, AWS/Azure/GCP, GitHub Actions, GitOps,
          security compliance, observability, and building developer platforms that teams actually use.
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

        <h4>April 2026 — Launch</h4>
        <p>
          danoh.com is live. Built this personal site as a retro AI-powered desktop —
          because a static portfolio felt too boring. Here&apos;s what shipped:
        </p>
        <ul>
          <li><strong>AI App Generator</strong> — describe any app in the Run dialog and it gets built on the fly using Claude Sonnet 4.6. Paint apps, calculators, games, whatever you can imagine.</li>
          <li><strong>Fix &amp; Iterate</strong> — click the <code>?</code> button on any generated app to chat with the AI. Report bugs, request features — the app updates live.</li>
          <li><strong>Blog</strong> — built-in blog reader right on the desktop. Posts are written in TypeScript, no CMS needed.</li>
          <li><strong>Resume</strong> — interactive resume with PDF download, viewable right in the OS.</li>
          <li><strong>Mobile-friendly</strong> — full touch support: tap to open, drag to rearrange icons, responsive windows.</li>
          <li><strong>Security hardened</strong> — access code gate, rate limiting, sandboxed iframes, prompt injection protections, constant-time auth.</li>
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
  filesystem: () => {
    return (
      <>
        <h3>Filesystem</h3>
        <p>
          In DanOh everything is a file. Including all of the programs that
          are running.
        </p>
        <p>
          You can explore the filesystem by opening up the aptly named{" "}
          <strong>Explorer</strong> program.
        </p>
        <p>
          Generated applications can also open and save files to the filesystem.
          Try prompting when generating to support file opening and saving
          operations for applications to define their own file formats. You can
          even read and write the contents of programs.
        </p>
      </>
    );
  },
  advanced: () => {
    return (
      <>
        <h3>Advanced</h3>
        <p>
          There are a few operating system apis that generated programs can use:
        </p>
        <ul>
          <li>Opening Files</li>
          <li>Saving Files</li>
          <li>Reading and Writing from the registry</li>
          <li>Chatting with an llm</li>
        </ul>
        <p>
          Try asking for these when generating an application to make the
          generated program use them. Opening and saving files is used for
          saving state of applications. The registry can be used for storing
          global configuration for a program (and across programs). And the chat
          api can make your program directly prompt an LLM.
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
    { title: "Filesystem", key: "filesystem" },
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
