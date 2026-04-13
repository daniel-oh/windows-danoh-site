import { Settings } from "@/state/settings";
export async function getSettingsFromGetRequest(
  req: Request
): Promise<Settings> {
  const url = new URL(req.url);
  const settingsParam = url.searchParams.get("settings");
  if (settingsParam) {
    try {
      const parsed = JSON.parse(decodeURIComponent(settingsParam));
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { apiKey: null };
      }
      return {
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : null,
        model: parsed.model === "cheap" ? "cheap" : "best",
      };
    } catch (error) {
      console.error("Error parsing settings from query string:", error);
      return { apiKey: null };
    }
  }
  return { apiKey: null };
}

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
