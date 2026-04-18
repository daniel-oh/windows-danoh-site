import { createClientFromSettings, getCheapestModel } from "@/ai/client";
import { createCompletion } from "@/ai/createCompletion";
import { getUser } from "@/lib/auth/getUser";
import { capture } from "@/lib/capture";
import { extractXMLTag } from "@/lib/extractXMLTag";
import { getSettingsFromJSON } from "@/lib/getSettingsFromRequest";
import { isLocal } from "@/lib/isLocal";

import { log } from "@/lib/log";
import { checkAccess } from "@/lib/apiGuard";
import { costGuard } from "@/lib/api/costGuard";
import { upstreamErrorResponse } from "@/lib/api/upstreamError";

export async function POST(req: Request) {
  const denied = await checkAccess(req, "name");
  if (denied) return denied;
  const capped = await costGuard(req);
  if (capped) return capped;
  const user = await getUser();
  if (!isLocal()) {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }
  }

  const body = await req.json();
  const { desc } = body;

  const settings = await getSettingsFromJSON(body);
  const { mode, usedOwnKey } = createClientFromSettings(settings);

  await capture(
    {
      type: "name",
      usedOwnKey,
      model: getCheapestModel(mode),
    },
    req
  );

  let response;
  try {
    response = await createCompletion({
      settings,
      label: "name",
      user,
      forceModel: "cheap",
      body: {
        messages: [
          {
            role: "system",
            content: prompt,
          },
          {
            role: "user",
            content: desc,
          },
        ],
        max_tokens: 4000,
      },
    });
  } catch (err) {
    return upstreamErrorResponse("name", err);
  }

  log(response);

  const content = response.choices[0].message.content;

  const name = extractXMLTag(content!, "appname");

  return new Response(JSON.stringify({ name }), { status: 200 });
}

const prompt = `You are an expert application namer. The user will give you a description
of an application and you will create a simple name for it. These applications are for
danoh.com, a retrofuturistic AI-powered operating system. Make the names creative and
whimsical. Put the name in <appname> tags.
`;
