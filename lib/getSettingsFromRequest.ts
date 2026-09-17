import { Settings } from "@/state/settings";
import { isOwnAnthropicKey } from "@/lib/api/hasOwnAnthropicKey";

// The GET-querystring variant of this module is gone with the
// /api/program GET endpoint — settings (and the API key inside them)
// now only ever travel in POST bodies, where proxy and CDN access
// logs can't see them.
//
// apiKey goes through the same shape check the gates use
// (hasOwnAnthropicKey). Anything the gates would not count as an own key
// is dropped here, so "gates skipped" and "visitor's key used" can never
// disagree.
export async function getSettingsFromJSON(json: any): Promise<Settings> {
  const settings = json?.settings;

  if (!settings || typeof settings !== "object") {
    return { apiKey: null, model: "best" };
  }
  return {
    apiKey: isOwnAnthropicKey(settings.apiKey) ? settings.apiKey : null,
    model: settings.model === "cheap" ? "cheap" : "best",
  };
}
