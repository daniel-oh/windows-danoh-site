import { streamAnthropicHtml } from "@/ai/streamAnthropicHtml";
import { getApiText } from "@/lib/apiText";
import { createPaymentRequiredResponse } from "@/server/paymentRequiredResponse";

import { getSettingsFromGetRequest } from "@/lib/getSettingsFromRequest";
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

export async function GET(req: Request) {
  // /api/program is loaded as an <iframe src="…">, so a raw JSON 429
  // would render as literal JSON text inside the window. Both gates
  // here get converted to a styled 98.css HTML page if they reject.
  const denied = await checkAccess(req, "program");
  if (denied) return jsonRejectionAsHtml(denied);

  // Production cost guardrail. apiGuard above only runs in local/dev
  // mode; costGuard is the prod ceiling — per-IP, per-visitor, and
  // global daily caps. Bypassed when the visitor brings their own key.
  const capped = await costGuard(req);
  if (capped) return jsonRejectionAsHtml(capped);

  const settings = await getSettingsFromGetRequest(req);
  const user = await getUser();
  if (!isLocal() && settings.model !== "cheap") {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
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

  const url = new URL(req.url);

  const desc = url.searchParams.get("description");
  let keys: string[];
  try {
    const parsed = JSON.parse(url.searchParams.get("keys") ?? "[]");
    if (!Array.isArray(parsed) || !parsed.every((k: unknown) => typeof k === "string")) {
      return new Response("Invalid keys parameter", { status: 400 });
    }
    // Validate each key matches allowed characters
    const keyPattern = /^[a-zA-Z0-9_-]+$/;
    if (!parsed.every((k: string) => keyPattern.test(k))) {
      return new Response("Invalid key format", { status: 400 });
    }
    keys = parsed;
  } catch {
    return new Response("Invalid keys parameter", { status: 400 });
  }
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
    return upstreamErrorResponse("program", err);
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
<title>danoh.com — rate limited</title>
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
