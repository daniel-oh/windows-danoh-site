import type { Settings } from "@/state/settings";
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic";

// Model choice, reviewed 2026-09 for quality per dollar ($ per 1M tokens):
//
//   best   claude-sonnet-5    $2 in / $10 out. Replaced Sonnet 4.6 ($3 / $15):
//          newer, markedly better at writing working front-end code, AND a
//          third cheaper per token. (Its tokenizer emits ~30% more tokens for
//          the same text, so equal output costs roughly 13% less, not 33%.)
//   cheap  claude-haiku-4-5   $1 / $5. Still the current small model. Used for
//          names, moderation, icon prompts, and anonymous chat.
//
//   Not used: claude-opus-5 ($5 / $25). 2.5x the price for a gain that a
//   single-file toy app mostly cannot show. If generated apps ever feel
//   underpowered, try raising BEST_EFFORT.generate before changing the model.
//
// IDs are the undated aliases on purpose: they are the documented form.
const BEST_MODEL = "claude-sonnet-5";
const CHEAP_MODEL = "claude-haiku-4-5";

export const getBestModel = (_mode: Provider) => BEST_MODEL;

export const getCheapestModel = (_mode: Provider) => CHEAP_MODEL;

/** What a call is for. Decides how much the model is allowed to deliberate. */
export type Task = "generate" | "converse";

// Sonnet 5 THINKS BY DEFAULT (4.6 did not), and thinking is billed as output
// and counts against max_tokens. So effort is the cost/quality dial here:
//   generate  "medium": roughly Sonnet 4.6 at its best, with a short plan
//             before the HTML. The visitor is watching a loading window, so
//             "high" would mostly buy a longer wait.
//   converse  "low": chat and Help answers; latency matters more than depth.
const BEST_EFFORT: Record<Task, "low" | "medium" | "high"> = {
  generate: "medium",
  converse: "low",
};

/**
 * Model-specific request fields. These are NOT interchangeable between the
 * two models, which is why they are decided in one place:
 *   - Sonnet 5 takes adaptive thinking + output_config.effort, and REJECTS a
 *     non-default temperature / top_p / top_k with a 400.
 *   - Haiku 4.5 rejects output_config.effort and runs without thinking unless
 *     asked, which is what we want from it.
 * Nothing in this app sets a sampling parameter any more.
 */
export function requestTuning(
  model: string,
  task: Task
): Pick<Anthropic.MessageCreateParams, "thinking" | "output_config"> {
  if (model !== BEST_MODEL) return {};
  return {
    thinking: { type: "adaptive" },
    output_config: { effort: BEST_EFFORT[task] },
  };
}

let cachedClient: Anthropic | null = null;
let cachedKey: string | undefined;

function getAnthropicClient(apiKey?: string): Anthropic {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedKey = key;
  cachedClient = new Anthropic({ apiKey: key });
  return cachedClient;
}

export function createClientFromSettings(settings: Settings): {
  mode: Provider;
  client: Anthropic;
  usedOwnKey: boolean;
  preferredModel: string;
} {
  const usedOwnKey = !!settings.apiKey;
  const mode: Provider = "anthropic";
  const client = getAnthropicClient(settings.apiKey || undefined);
  const preferredModel =
    settings.model === "cheap" ? getCheapestModel(mode) : getBestModel(mode);

  return { mode, client, usedOwnKey, preferredModel };
}
