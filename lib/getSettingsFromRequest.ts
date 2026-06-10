import { Settings } from "@/state/settings";

// The GET-querystring variant of this module is gone with the
// /api/program GET endpoint — settings (and the API key inside them)
// now only ever travel in POST bodies, where proxy and CDN access
// logs can't see them.
export async function getSettingsFromJSON(json: any): Promise<Settings> {
  const settings = json.settings;

  if (!settings) {
    return { apiKey: null, model: "best" };
  }
  return {
    apiKey: settings.apiKey,
    model: settings.model === "cheap" ? "cheap" : "best",
  };
}
