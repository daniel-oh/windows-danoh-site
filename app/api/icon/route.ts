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
import { upstreamErrorResponse } from "@/lib/api/upstreamError";

export async function POST(req: Request) {
  const denied = await checkAccess(req, "icon");
  if (denied) return denied;
  const user = await getUser();
  if (!isLocal()) {
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

  const body = await req.json();
  const settings = await getSettingsFromJSON(body);
  const prompt = body.name;

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

  const path = await put(`icons/${generateUniqueID()}.png`, image);
  return new Response(path, { status: 200 });
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
