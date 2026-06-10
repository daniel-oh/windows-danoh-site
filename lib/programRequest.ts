import { ProgramEntry } from "@/state/programs";
import { RegistryEntry } from "@/state/registry";
import { getRegistryKeys } from "./getRegistryKeys";
import { getSettings } from "./getSettings";

// POST body for /api/program. This used to be a GET querystring, which
// put the visitor's API key (inside `settings`) into proxy and CDN
// access logs, and silently truncated prompts at the first `&` because
// the description was never URL-encoded. A JSON body has neither
// problem.
export function getProgramRequestBody(
  program: ProgramEntry,
  registry: RegistryEntry
) {
  return {
    description: program.prompt,
    keys: getRegistryKeys(registry),
    settings: getSettings(),
  };
}
