import { Settings } from "@/state/settings";

export function getMaxTokens(settings: Settings) {
  if (settings.model === "best") {
    return 8192;
  }
  return 4096;
}
