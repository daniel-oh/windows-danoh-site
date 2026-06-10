import { streamAnthropicHtml } from "@/ai/streamAnthropicHtml";
import { getApiText } from "@/lib/apiText";
import { createPaymentRequiredResponse } from "@/server/paymentRequiredResponse";

import { getSettingsFromJSON } from "@/lib/getSettingsFromRequest";
import { createClientFromSettings } from "@/ai/client";
import { Settings } from "@/state/settings";
import { getUser } from "@/lib/auth/getUser";
import { log } from "@/lib/log";
import { capture } from "@/lib/capture";
import { canGenerate } from "@/server/usage/canGenerate";
import { createClient } from "@/lib/supabase/server";
import { insertGeneration } from "@/server/usage/insertGeneration";
import { isLocal } from "@/lib/isLocal";
import { createStreamingCompletion } from "@/ai/createCompletion";
import { getMaxTokens } from "@/ai/getMaxTokens";
import { checkAccess } from "@/lib/apiGuard";
import { costGuard } from "@/lib/api/costGuard";
import { upstreamErrorResponse } from "@/lib/api/upstreamError";

// POST, not GET: the response streams into the sandboxed bootstrap
// iframe via parent fetch + postMessage (see Iframe.tsx), so nothing
// needs a URL-addressable endpoint — and the old querystring put the
// visitor's API key (inside `settings`) into proxy/CDN access logs
// and truncated prompts at the first unencoded `&`.
export async function POST(req: Request) {
  // The response renders inside a window, so a raw JSON 429 would
  // show as literal JSON text. Both gates here get converted to a
  // styled 98.css HTML page if they reject.
  const denied = await checkAccess(req, "program");
  if (denied) return jsonRejectionAsHtml(denied);

  // Production cost guardrail. apiGuard above only runs in local/dev
  // mode; costGuard is the prod ceiling — per-IP, per-visitor, and
  // global daily caps. Bypassed when the visitor brings their own key.
  const capped = await costGuard(req);
  if (capped) return jsonRejectionAsHtml(capped);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const { description, keys: rawKeys } = (body ?? {}) as {
    description?: unknown;
    keys?: unknown;
  };

  const settings = await getSettingsFromJSON(body);
  const user = await getUser();
  if (!isLocal() && settings.model !== "cheap") {
    if (!user) {
      // Styled like the other rejections — raw JSON would render as
      // literal text inside the program window.
      return jsonRejectionAsHtml(
        new Response(
          JSON.stringify({
            error:
              "Sign in (or add your own Anthropic API key in Settings) to use the quality model.",
          }),
          { status: 401 }
        )
      );
    }

    if (!settings.apiKey) {
      const client = await createClient();
      const hasTokens = await canGenerate(client, user);

      if (!hasTokens) {
        return createPaymentRequiredResponse();
      }

      await insertGeneration({
        client,
        user,
        tokensUsed: 1,
        action: "program",
      });
    }
  }

  const desc = typeof description === "string" ? description : null;
  const parsed = rawKeys ?? [];
  if (
    !Array.isArray(parsed) ||
    !parsed.every((k: unknown) => typeof k === "string")
  ) {
    return new Response("Invalid keys parameter", { status: 400 });
  }
  // Validate each key matches allowed characters
  const keyPattern = /^[a-zA-Z0-9_-]+$/;
  if (!parsed.every((k: string) => keyPattern.test(k))) {
    return new Response("Invalid key format", { status: 400 });
  }
  const keys: string[] = parsed;
  if (!desc) {
    return new Response("No description", {
      status: 404,
    });
  }
  if (desc.length > 2000) {
    return new Response("Description too long (max 2000 characters)", { status: 400 });
  }

  let programStream;
  try {
    programStream = await createProgramStream({
      desc,
      keys,
      settings,
      req,
    });
  } catch (err) {
    return jsonRejectionAsHtml(upstreamErrorResponse("program", err));
  }
  const parentOrigin = new URL(req.url).origin;
  return new Response(
    streamAnthropicHtml(programStream, {
      injectIntoHead: `<script>window.__PARENT_ORIGIN__=${JSON.stringify(parentOrigin)}</script>
<script src="/api.js"></script>
<link
  rel="stylesheet"
href="https://unpkg.com/98.css"
>
<link
  rel="stylesheet"
  href="/reset.css"
>`,
    }),
    {
      headers: {
        "Content-Type": "text/html",
      },
      status: 200,
    }
  );
}

// Converts a JSON rejection from checkAccess / costGuard into a
// lightweight 98.css-styled HTML document so the iframe renders
// something readable instead of raw `{"error":"…"}` text.
async function jsonRejectionAsHtml(res: Response): Promise<Response> {
  let message = "That's all for now. Try again shortly.";
  try {
    const data = await res.clone().json();
    if (typeof data?.error === "string") message = data.error;
  } catch {
    /* non-JSON response — fall back to the default message */
  }
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="danoh-error" content="generation-rejected">
<title>danoh.com · generation paused</title>
<link rel="stylesheet" href="https://unpkg.com/98.css">
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;padding:16px;background:#c0c0c0;font-family:"Pixelated MS Sans Serif",Arial,sans-serif}
  .card{max-width:360px;width:100%}
  h1{font-size:14px;margin:0 0 8px}
  p{font-size:13px;line-height:1.5;margin:0 0 10px}
  .hint{font-size:11px;color:#555}
</style>
</head>
<body>
  <div class="window card">
    <div class="title-bar"><div class="title-bar-text">Generation paused</div></div>
    <div class="window-body">
      <h1>At the limit for now</h1>
      <p>${safe}</p>
      <p class="hint">Want to keep running without waiting? Drop your own Anthropic API key in Settings and we'll step out of the way.</p>
    </div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: res.status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function makeSystem(keys: string[]) {
  log(keys);
  return `You are danoh.com, an AI-powered retro operating system that generates fully functional applications on demand. You will receive a description of an application, and your job is to imagine what it does and build it.

Implement the application in HTML, CSS, and JavaScript. Use the 98.css library for a retro Windows 98 aesthetic — it's already included. The code runs inside an iframe within a window, so don't include window or window-body wrapper elements.

Rules:
- Output ONLY the raw HTML wrapped in <html> tags. No commentary, explanations, or markdown.
- The app runs inside a resizable iframe. Use width:100% and height:100% on html/body. Use relative units (%, vh, vw, flex, grid) not fixed pixel sizes for layout. The app must look good at any size.
- Use overflow:auto on scrollable areas so content is accessible when the window is small.
- Don't use external images — draw assets with CSS/SVG/canvas.
- Don't use the 98.css \`window\` or \`window-body\` classes.
- Don't add a menu bar — the OS handles that.
- Make the app genuinely functional and interactive, not just a mockup.
- Use modern JavaScript (ES2020+). Add event listeners, state management, and real logic.
- Be creative — build something that actually works and is fun to use.

The OS provides these APIs on the window object:

${getApiText(keys)}
`;
}

async function createProgramStream({
  desc,
  keys,
  settings,
  req,
}: {
  desc: string;
  keys: string[];
  settings: Settings;
  req: Request;
}) {
  const { usedOwnKey, preferredModel } = createClientFromSettings(settings);

  await capture(
    {
      type: "program",
      usedOwnKey,
      model: preferredModel,
    },
    req
  );

  // Sanitize user input to prevent prompt injection via XML tags
  const sanitizedDesc = desc
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const stream = createStreamingCompletion({
    settings,
    body: {
      messages: [
        {
          role: "system",
          content: makeSystem(keys),
        },
        {
          role: "user",
          content: `<app_name>${sanitizedDesc}</app_name>`,
        },
      ],
      temperature: 1,
      max_tokens: getMaxTokens(settings),
    },
  });

  return stream;
}
