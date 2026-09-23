import { createClientFromSettings, getCheapestModel } from "@/ai/client";
import { createCompletion } from "@/ai/createCompletion";
import { generateIcon } from "@/ai/image";
import { getUser } from "@/lib/auth/getUser";
import { capture } from "@/lib/capture";
import { getSettingsFromJSON } from "@/lib/getSettingsFromRequest";
import { isLocal } from "@/lib/isLocal";
import { put } from "@/lib/put";
import { createClient } from "@/lib/supabase/server";
import { canGenerate } from "@/server/usage/canGenerate";
import { Settings } from "@/state/settings";
import { User } from "@supabase/supabase-js";
import { createPaymentRequiredResponse } from "@/server/paymentRequiredResponse";
import { checkAccess } from "@/lib/apiGuard";
import { costGuard } from "@/lib/api/costGuard";
import { upstreamErrorResponse } from "@/lib/api/upstreamError";
import { parseJson, rejectOversized, requireJson } from "@/lib/api/json";

export async function POST(req: Request) {
  // Before the gates: forces a CORS preflight, so a cross-site form
  // can't spend a visitor's session or rate-limit budget.
  const notJson = requireJson(req);
  if (notJson) return notJson;
  const oversized = await rejectOversized(req);
  if (oversized) return oversized;
  // Icons need Replicate. Without a token this route used to pass the
  // gates (spending the visitor's rate-limit budget), pay for a Haiku call
  // to write an image prompt, and only then fail inside generateIcon, on
  // every single "best" generation. Say so up front; the client stops
  // asking after the first 503 (see fetchIcon in Iframe.tsx).
  if (!process.env.REPLICATE_API_TOKEN) {
    return Response.json(
      { error: "Icon generation is not configured" },
      { status: 503 }
    );
  }
  const denied = await checkAccess(req, "icon");
  if (denied) return denied;
  const capped = await costGuard(req);
  if (capped) return capped;
  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const settings = await getSettingsFromJSON(body);

  // A visitor who brings their own Anthropic API key pays for their own
  // inference, so they skip both sign-in and token accounting. Only when
  // there's no own key does the user/token gate run.
  const user = await getUser();
  if (!isLocal() && !settings.apiKey) {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
    const client = await createClient();

    if (!(await canGenerate(client, user))) {
      return createPaymentRequiredResponse();
    }
  }

  const prompt = body.name;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }
  // Same bound as MAX_NAME in /api/programs: this goes into a model prompt.
  if (prompt.length > 200) {
    return Response.json({ error: "name is too long (max 200)" }, { status: 400 });
  }

  let imagePrompt: string | null;
  try {
    imagePrompt = await genImagePrompt({
      name: prompt,
      settings,
      req,
      user,
    });
  } catch (err) {
    return upstreamErrorResponse("icon", err);
  }
  if (!imagePrompt) {
    return upstreamErrorResponse("icon", new Error("Empty image prompt"));
  }

  let image;
  try {
    image = await generateIcon(imagePrompt);
  } catch (err) {
    return upstreamErrorResponse("image", err);
  }
  if (!image) {
    return upstreamErrorResponse("image", new Error("Empty image response"));
  }

  try {
    const path = await put(`icons/${generateUniqueID()}.png`, image);
    return new Response(path, { status: 200 });
  } catch (err) {
    console.warn("[icon] storage unavailable:", err);
    return Response.json({ error: "Icon storage unavailable" }, { status: 503 });
  }
}

function generateUniqueID() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

const imageDescriptionPrompt = `You will be given the name of an application. Return a description of the icon that can be fed into stable diffusion to generate an icon for the application. Return only the description, do not return any other text.`;

async function genImagePrompt({
  name,
  settings,
  req,
  user,
}: {
  name: string;
  settings: Settings;
  req: Request;
  user: User | null;
}) {
  const { mode, usedOwnKey } = createClientFromSettings(settings);
  await capture(
    {
      type: "icon",
      usedOwnKey,
      model: getCheapestModel(mode),
    },
    req
  );
  const result = await createCompletion({
    settings,
    label: "icon",
    user,
    forceModel: "cheap",
    body: {
      messages: [
        { role: "system", content: imageDescriptionPrompt },
        { role: "user", content: name },
      ],
    },
  });

  return result.choices[0].message.content;
}
