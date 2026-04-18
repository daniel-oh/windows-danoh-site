import { createClientFromSettings } from "@/ai/client";
import { createCompletion } from "@/ai/createCompletion";
import { getMaxTokens } from "@/ai/getMaxTokens";
import { getUser } from "@/lib/auth/getUser";
import { capture } from "@/lib/capture";
import { getSettingsFromJSON } from "@/lib/getSettingsFromRequest";
import { isLocal } from "@/lib/isLocal";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { canGenerate } from "@/server/usage/canGenerate";
import { insertGeneration } from "@/server/usage/insertGeneration";
import { createPaymentRequiredResponse } from "@/server/paymentRequiredResponse";
import { checkAccess } from "@/lib/apiGuard";
import { costGuard } from "@/lib/api/costGuard";
import { sanitizeWithSystem } from "@/lib/sanitizeMessages";
import { upstreamErrorResponse } from "@/lib/api/upstreamError";

export async function POST(req: Request) {
  const denied = await checkAccess(req, "help");
  if (denied) return denied;
  const capped = await costGuard(req);
  if (capped) return capped;
  const body = await req.json();
  const settings = await getSettingsFromJSON(body);
  const user = await getUser();
  if (!isLocal()) {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    if (!settings.apiKey && settings.model !== "cheap") {
      const client = await createClient();
      const hasTokens = await canGenerate(client, user);

      if (!hasTokens) {
        return createPaymentRequiredResponse();
      }

      await insertGeneration({
        client,
        user,
        tokensUsed: 1,
        action: "help",
      });
    }
  }

  const { messages: rawMessages } = body;

  // Keep only the first system message (server-set prompt) and recent user/assistant messages
  const messages = sanitizeWithSystem(rawMessages);

  log(messages);

  const { usedOwnKey, preferredModel } = createClientFromSettings(settings);

  await capture(
    {
      type: "help",
      usedOwnKey,
      model: preferredModel,
    },
    req
  );

  let response;
  try {
    response = await createCompletion({
      settings,
      label: "help",
      user,
      body: {
        messages: [...messages],
        max_tokens: getMaxTokens(settings),
      },
    });
  } catch (err) {
    return upstreamErrorResponse("help", err);
  }

  log(response);

  const content = response.choices[0].message.content;

  log(content);

  return new Response(JSON.stringify(content), { status: 200 });
}
