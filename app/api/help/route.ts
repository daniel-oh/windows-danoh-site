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
import { sanitizeUserMessages } from "@/lib/sanitizeMessages";
import { buildHelpSystem, extractAppContext } from "@/lib/helpPrompt";
import { upstreamErrorResponse } from "@/lib/api/upstreamError";
import { parseJson } from "@/lib/api/json";

export async function POST(req: Request) {
  const denied = await checkAccess(req, "help");
  if (denied) return denied;
  const capped = await costGuard(req);
  if (capped) return capped;
  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const settings = await getSettingsFromJSON(body);
  const user = await getUser();
  // A visitor who brings their own Anthropic API key pays for their own
  // inference, so they skip both sign-in and token accounting. Only when
  // there's no own key does the user/token gate run.
  if (!isLocal() && !settings.apiKey) {
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    if (settings.model !== "cheap") {
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

  // The system prompt (behavioral rules + guardrails) is built SERVER-SIDE.
  // The client's "system" message is treated as untrusted app-context data
  // and wrapped inside it — a client can't substitute its own system
  // prompt to repurpose this endpoint. Conversation turns are role-filtered
  // and length-capped as before.
  const messages = [
    {
      role: "system" as const,
      content: buildHelpSystem(extractAppContext(rawMessages)),
    },
    ...sanitizeUserMessages(rawMessages),
  ];

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
