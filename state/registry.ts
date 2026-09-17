import { atom, getDefaultStore } from "jotai";
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

// --- Serialized access for generated apps ------------------------------
//
// registryAtom above is fine for React (it re-renders from a file atom
// that polls every 2s), but it is the wrong tool for the iframe message
// handler, which needs two things the atom cannot give:
//
//   read-your-writes: after `await registry.set(k, v)`, `registry.get(k)`
//     must return v. Reading the polled atom returned the pre-write
//     snapshot for up to 2 seconds.
//   no lost updates: set was "read the whole object, spread, write the
//     whole object" with nothing in between, so two apps (or one app doing
//     Promise.all) writing at once both started from the same snapshot and
//     the later write erased the earlier one.
//
// One module-level chain puts every read and write in a single line. It is
// module-level, not per-Iframe, because every open app shares one file.
// Reads go to the file itself, never the cached atom.
let chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  // A failed task must not wedge the queue for everyone behind it.
  chain = run.catch(() => undefined);
  return run;
}

async function readFromDisk(): Promise<RegistryEntry> {
  const fs = await getFsManager();
  const file = await fs.getFile(REGISTRY_PATH, "deep");
  try {
    return JSON.parse((file?.content as string) || "{}");
  } catch {
    return {};
  }
}

/** Current registry, after every write queued before this call. */
export function readRegistry(): Promise<RegistryEntry> {
  return enqueue(readFromDisk);
}

/** Read-modify-write as one step. Resolves once the write is durable. */
export function updateRegistry(
  mutate: (current: RegistryEntry) => RegistryEntry
): Promise<void> {
  return enqueue(async () => {
    const fs = await getFsManager();
    const next = mutate(await readFromDisk());
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(next));
    // Nudge the React side now instead of at the next 2s poll (the
    // wallpaper key, for one, is rendered from registryAtom).
    getDefaultStore().set(fs.getFileAtom(REGISTRY_PATH));
  });
}

export const DESKTOP_URL_KEY = "public_desktop_url";

export const BUILTIN_REGISTRY_KEYS = [DESKTOP_URL_KEY];
