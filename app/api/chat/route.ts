import { createClientFromSettings } from "@/ai/client";
import { createCompletion } from "@/ai/createCompletion";
import { getMaxTokens } from "@/ai/getMaxTokens";
import { getUser } from "@/lib/auth/getUser";
import { capture } from "@/lib/capture";
import { getSettingsFromJSON } from "@/lib/getSettingsFromRequest";
import { isLocal } from "@/lib/isLocal";
import { log } from "@/lib/log";
import { checkAccess } from "@/lib/apiGuard";
import { costGuard } from "@/lib/api/costGuard";
import { sanitizeUserMessages } from "@/lib/sanitizeMessages";
import { upstreamErrorResponse } from "@/lib/api/upstreamError";
import { parseJson } from "@/lib/api/json";

export async function POST(req: Request) {
  const denied = await checkAccess(req, "chat");
  if (denied) return denied;
  const capped = await costGuard(req);
  if (capped) return capped;
  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const settings = await getSettingsFromJSON(body);

  // A visitor who brings their own Anthropic API key pays for their own
  // inference, so they skip sign-in. Only when there's no own key does
  // the sign-in gate run.
  const user = await getUser();
  if (!isLocal() && !settings.apiKey && !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { messages: rawMessages } = body;

  // Strip any client-injected system messages and limit size
  const messages = sanitizeUserMessages(rawMessages);

  log(messages);

  // Own-key visitors get the model they chose; on our dime chat is
  // forced to the cheap model.
  const forceModel = settings.apiKey ? undefined : "cheap";

  const { usedOwnKey, preferredModel } = createClientFromSettings({
    ...settings,
    model: forceModel ?? settings.model,
  });

  await capture(
    {
      type: "chat",
      usedOwnKey,
      model: preferredModel,
    },
    req
  );

  let response;
  try {
    response = await createCompletion({
      settings,
      label: "chat",
      user,
      forceModel,
      body: {
        messages: [...messages],
        max_tokens: getMaxTokens(settings),
      },
    });
  } catch (err) {
    return upstreamErrorResponse("chat", err);
  }

  log(response);

  const content = response.choices[0].message.content;

  log(content);

  return new Response(JSON.stringify(content), { status: 200 });
}
