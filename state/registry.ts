import { atom } from "jotai";
import { REGISTRY_PATH } from "@/lib/filesystem/defaultFileSystem";
import { getFsManager } from "@/state/fsManager";

export interface RegistryEntry {
  [key: string]: any;
}

export const registryAtom = atom(
  async (get) => {
    const fs = await getFsManager();
    const registry = await get(fs.getFileAtom(REGISTRY_PATH));
    try {
      return JSON.parse((registry?.content as string) || "{}");
    } catch (error) {
      console.error("Failed to parse registry:", error);
      return {};
    }
  },
  async (_get, _set, update: RegistryEntry) => {
    const fs = await getFsManager();
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(update));
  }
);

export const DESKTOP_URL_KEY = "public_desktop_url";
export const THEME_KEY = "public_theme";

export type Theme = "light" | "dark";
export const DEFAULT_THEME: Theme = "light";

export const BUILTIN_REGISTRY_KEYS = [DESKTOP_URL_KEY, THEME_KEY];
