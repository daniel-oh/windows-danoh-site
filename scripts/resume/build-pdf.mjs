// Renders scripts/resume/resume.html to public/Daniel_Oh_Resume.pdf via
// headless Chromium. Run from anywhere:
//   node scripts/resume/build-pdf.mjs
// Requires playwright to be importable (npx playwright install chromium
// once per machine). Kept as a script, not a build step — the resume
// changes a few times a year.
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

// playwright isn't a project dependency (it's only needed for this
// script) — resolve it from wherever the invoking directory has it.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  const req = createRequire(join(process.cwd(), "package.json"));
  ({ chromium } = req("playwright"));
}

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "resume.html");
const out = join(here, "..", "..", "public", "Daniel_Oh_Resume.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + src, { waitUntil: "networkidle" });
await page.pdf({
  path: out,
  format: "Letter",
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});
await browser.close();
console.log("Wrote", out);
