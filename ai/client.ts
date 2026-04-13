import type { Settings } from "@/state/settings";
import Anthropic from "@anthropic-ai/sdk";

export type Provider = "anthropic";

export const getBestModel = (_mode: Provider) => {
  return "claude-sonnet-4-6";
};

export const getCheapestModel = (_mode: Provider) => {
  return "claude-haiku-4-5-20251001";
};

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
