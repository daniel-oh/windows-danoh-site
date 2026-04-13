export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  author: string;
  summary: string;
  tags: string[];
  content: string;
};

export const posts: BlogPost[] = [
  {
    slug: "welcome-to-lootrunners",
    title: "Welcome to Lootrunners",
    date: "2026-04-09",
    author: "Lootrunners Team",
    summary: "Introducing Lootrunners — an AI-powered retro OS that generates apps on the fly.",
    tags: ["announcement", "launch"],
    content: `
Lootrunners is a retro operating system experience powered by AI. Describe any application you want, and it gets generated on the fly — right inside a Windows 98-style desktop.

![Lootrunners Desktop](/lootrunners-website.png?v=1)

## How it works

1. Click **Start > Run**
2. Describe the app you want — "paint app", "calculator", "snake game", anything
3. The AI generates a fully functional HTML/CSS/JS application in seconds
4. It opens in a draggable, resizable window on your desktop

## Fix & Iterate

Found a bug in a generated app? Click the **?** button on any app window to open the **Fix & Iterate** chat. Describe what's wrong, and the AI developer fixes the code and updates the app live — no reload needed.

## What can you build?

Anything that runs in a browser:

- **Games** — chess, snake, tetris, minesweeper
- **Productivity** — calculators, timers, todo lists, note-taking
- **Creative tools** — paint apps, pixel editors, music sequencers
- **Data tools** — charts, unit converters, JSON formatters
- **Fun stuff** — quote generators, fortune tellers, trivia games

The only limit is your imagination.

## The tech behind it

Lootrunners is built with:

- **Next.js 16** + **React 19** for the frontend
- **Anthropic Claude** for AI-powered app generation
- **98.css** for the authentic Windows 98 aesthetic
- **Docker** + **Traefik** for deployment
- **PostgreSQL** for session management

> "The future of yesterday" — every app you generate feels like discovering a lost program from an alternate reality 1998.

Stay tuned for updates. We're just getting started.
    `,
  },
  {
    slug: "ai-app-generation",
    title: "How AI App Generation Works",
    date: "2026-04-10",
    author: "Lootrunners Team",
    summary: "A look under the hood at how Lootrunners generates applications from text descriptions.",
    tags: ["engineering", "ai"],
    content: `
Ever wondered how typing "paint app" into a text box creates a fully functional painting application? Here's what happens behind the scenes.

## The Pipeline

### 1. Prompt Engineering

Your description gets wrapped in a carefully crafted system prompt that instructs Claude to generate a complete, standalone HTML application. The prompt includes:

- Rules for responsive design (relative units, overflow handling)
- The 98.css library for Windows 98 styling
- OS APIs for file access, registry, and chat capabilities
- Guidelines for making apps genuinely functional, not just mockups

### 2. Streaming Generation

The AI response streams directly into an iframe — you literally watch the app build itself in real-time as HTML chunks arrive over the network. No loading spinner, no waiting for the full response. The app appears piece by piece.

### 3. Code Capture & Caching

Once streaming completes, the generated HTML is captured from the iframe's DOM and cached. The next time you open that app, it loads instantly — no AI call needed.

### 4. Live Iteration

The **?** button on any app window opens a chat where the AI has full context of your app's source code. You can:

- Report bugs: *"The canvas doesn't respond to touch"*
- Request features: *"Add a color picker"*
- Ask questions: *"How does the undo system work?"*

The AI responds with updated code that's applied live — the app changes in front of your eyes.

## Security & Safety

Generated apps run in sandboxed iframes with restricted permissions. They can execute JavaScript but can't access the parent page, make cross-origin requests, or access your data outside the provided OS APIs.

---

*Have questions about how Lootrunners works? Open a **Run** dialog and ask the AI to build you something.*
    `,
  },
];

export const sortedPosts = [...posts].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);
