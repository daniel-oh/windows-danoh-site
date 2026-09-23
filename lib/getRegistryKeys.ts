import { MAX_KEY_LENGTH, MAX_PROMPT_KEYS } from "./registryLimits";
import { BUILTIN_REGISTRY_KEYS, RegistryEntry } from "@/state/registry";

export function getRegistryKeys(registry: RegistryEntry): string[] {
  // Built-ins first so they always make the cut, then the shared keys
  // apps have made, trimmed to what the server accepts.
  const keys = new Set<string>(BUILTIN_REGISTRY_KEYS);
  for (const key of Object.keys(registry).sort()) {
    if (keys.size >= MAX_PROMPT_KEYS) break;
    if (key.startsWith("public_") && key.length <= MAX_KEY_LENGTH) keys.add(key);
  }

  return Array.from(keys).sort();
}
