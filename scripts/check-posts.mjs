// Prebuild consistency check for the blog content registry.
// Fails the build when content/blog/posts/*.mdx and registry.tsx
// disagree — the drift that used to ship either an invisible orphan
// (file without an entry) or an indexed soft-404 (entry without a
// file). Also sanity-checks each meta's slug and reading time.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content/blog/posts");
const registryPath = path.join(root, "content/blog/registry.tsx");

const registry = fs.readFileSync(registryPath, "utf8");
const imported = [...registry.matchAll(/from "\.\/posts\/(.+?)\.mdx"/g)]
  .map((m) => m[1])
  .sort();
const onDisk = fs
  .readdirSync(postsDir)
  .filter((f) => f.endsWith(".mdx"))
  .map((f) => f.slice(0, -4))
  .sort();

const errors = [];

for (const slug of onDisk) {
  if (!imported.includes(slug)) {
    errors.push(`posts/${slug}.mdx exists but is not imported in registry.tsx`);
  }
}
for (const slug of imported) {
  if (!onDisk.includes(slug)) {
    errors.push(`registry.tsx imports posts/${slug}.mdx which does not exist`);
  }
}

const WPM = 220;
for (const slug of onDisk) {
  const src = fs.readFileSync(path.join(postsDir, `${slug}.mdx`), "utf8");

  // meta.slug must equal the filename — every consumer keys on it.
  const slugMatch = src.match(/^\s*slug:\s*"([^"]+)"/m);
  if (!slugMatch) {
    errors.push(`posts/${slug}.mdx has no slug in its meta export`);
  } else if (slugMatch[1] !== slug) {
    errors.push(
      `posts/${slug}.mdx declares slug "${slugMatch[1]}" (must match filename)`
    );
  }

  // Reading time: warn-only, with a generous band — it's display copy,
  // not data, but a 2x drift misleads readers.
  const rtMatch = src.match(/readingTime:\s*"(\d+)\s*min"/);
  if (rtMatch) {
    const claimed = parseInt(rtMatch[1], 10);
    const body = src
      .replace(/^export const meta = \{[\s\S]*?\};/m, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/^import .*$/gm, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#*_`>\[\]()|-]/g, " ");
    const words = body.split(/\s+/).filter(Boolean).length;
    const actual = Math.max(1, Math.round(words / WPM));
    if (Math.abs(claimed - actual) > Math.max(1, actual * 0.5)) {
      console.warn(
        `[check-posts] WARN posts/${slug}.mdx claims ${claimed} min, ` +
          `~${actual} min at ${WPM}wpm (${words} words)`
      );
    }
  }
}

if (errors.length) {
  console.error("[check-posts] FAILED:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `[check-posts] OK — ${onDisk.length} posts, registry and disk agree`
);
