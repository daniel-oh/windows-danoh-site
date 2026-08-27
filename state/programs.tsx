import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { PROGRAMS_PATH } from "@/lib/filesystem/defaultFileSystem";
import { getFsManager } from "@/state/fsManager";
import { DeepFolder, DeepItem } from "@/lib/filesystem/Drive";

export type ProgramEntry = {
  id: string;
  name: string;
  prompt: string;
  code?: string;
  icon?: string | null;
  currentVersion?: number;
};

type ProgramsState = {
  programs: ProgramEntry[];
};

/** Cap on generated programs per browser (each is a VFS folder with a
 * version history, so this bounds IndexedDB growth). */
export const PROGRAM_LIMIT = 50;

export class ProgramLimitError extends Error {
  constructor() {
    super(`Program limit reached (${PROGRAM_LIMIT})`);
    this.name = "ProgramLimitError";
  }
}

type ProgramAction =
  | { type: "ADD_PROGRAM"; payload: ProgramEntry }
  | { type: "REMOVE_PROGRAM"; payload: string }
  | {
      type: "UPDATE_PROGRAM";
      payload: Partial<ProgramEntry> & { id: string };
    }
  | {
      type: "CHANGE_VERSION";
      payload: { id: string; version: number };
    }
  | {
      type: "DELETE_VERSION";
      payload: { id: string; version: number };
    };

// Write result typed as the promise it actually is, so callers can await
// it (Run) or attach a catch (Desktop sync) for the program-cap error.
export const programsAtom = atom<
  Promise<ProgramsState>,
  [ProgramAction],
  Promise<void>
>(
  async (get) => {
    const fsManager = await getFsManager();
    const programs = await get(fsManager.getFolderAtom(PROGRAMS_PATH, "deep"));
    if (!programs) {
      return {
        programs: [],
      };
    }
    return {
      programs: Object.values(programs.items)
        .map(getProgramEntry)
        .filter(Boolean) as ProgramEntry[],
    };
  },
  async (_get, _set, action) => {
    const fsManager = await getFsManager();
    await programsReducer(fsManager, action);
  }
);

// main.exe is written by us but lives in user-controlled storage
// (IndexedDB / mounted dirs) — a single corrupt file must degrade to
// "this program is skipped", not throw inside the programsAtom read
// and take down the whole desktop.
function parseProgramConfig(content: unknown): Record<string, any> {
  if (typeof content !== "string" || !content) return {};
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getProgramEntry(item: DeepItem): ProgramEntry | null {
  if (item.type !== "folder") return null;
  const folder = item as DeepFolder;
  const main = folder.items["main.exe"];
  if (!main || main.type !== "file") {
    return null;
  }

  const index = folder.items["index.html"];
  let code: string | null = null;
  if (index && index.type === "file") {
    code = index.content as string;
  }
  const config = parseProgramConfig(main.content);
  return {
    ...config,
    id: folder.name,
    name: folder.name,
    prompt: typeof config.prompt === "string" ? config.prompt : "",
    code: code ?? undefined,
    currentVersion: config.currentVersion || Date.now(),
  };
}

async function programsReducer(
  fsManager: Awaited<ReturnType<typeof getFsManager>>,
  action: ProgramAction
): Promise<void> {
  switch (action.type) {
    case "ADD_PROGRAM": {
      const existing = await fsManager.getFolder(PROGRAMS_PATH, "shallow");
      if (existing && Object.keys(existing.items).length >= PROGRAM_LIMIT) {
        // Silently skipping left Run's already-open window on
        // "Generating program..." forever. Throw so the caller can tell
        // the visitor and not open a window for a program that was never
        // written.
        throw new ProgramLimitError();
      }
      const { code, id: _id, name: _name, ...rest } = action.payload;
      const path = `${PROGRAMS_PATH}/${action.payload.id}`;
      const timestamp = Date.now();
      await fsManager.createFolder(path);
      await fsManager.writeFile(
        `${path}/main.exe`,
        JSON.stringify({ ...rest, currentVersion: timestamp })
      );
      await fsManager.writeFile(`${path}/index.html`, code ?? "");

      // Add version
      await addVersion(fsManager, path, code ?? "", timestamp);
      break;
    }
    case "REMOVE_PROGRAM": {
      await fsManager.delete(`${PROGRAMS_PATH}/${action.payload}`);
      break;
    }
    case "UPDATE_PROGRAM": {
      const path = `${PROGRAMS_PATH}/${action.payload.id}`;
      const { id: _id, name: _name, ...rest } = action.payload;

      if ("code" in rest) {
        const code = rest.code;
        delete rest.code;
        const timestamp = Date.now();
        await fsManager.writeFile(`${path}/index.html`, code ?? "");

        // Add version
        await addVersion(fsManager, path, code ?? "", timestamp);

        // Update currentVersion in main.exe
        const existingContent = await (
          await fsManager.getFile(`${path}/main.exe`, "deep")
        )?.content;
        const existing = parseProgramConfig(existingContent);
        await fsManager.writeFile(
          `${path}/main.exe`,
          JSON.stringify({ ...existing, ...rest, currentVersion: timestamp })
        );
      } else {
        const existingContent = await (
          await fsManager.getFile(`${path}/main.exe`, "deep")
        )?.content;
        const existing = parseProgramConfig(existingContent);
        await fsManager.writeFile(
          `${path}/main.exe`,
          JSON.stringify({ ...existing, ...rest })
        );
      }
      break;
    }
    case "CHANGE_VERSION": {
      const { id, version } = action.payload;
      const path = `${PROGRAMS_PATH}/${id}`;
      const versionsPath = `${path}/versions`;
      const versionFileName = `${version}.html`;

      // Read the code from the specified version
      const newCode = await fsManager.getFile(
        `${versionsPath}/${versionFileName}`,
        "deep"
      );

      if (!newCode?.content) {
        return;
      }

      // Update the current code
      await fsManager.writeFile(`${path}/index.html`, newCode?.content);

      // Update currentVersion in main.exe
      const existingContent = await (
        await fsManager.getFile(`${path}/main.exe`, "deep")
      )?.content;
      const existing = parseProgramConfig(existingContent);
      await fsManager.writeFile(
        `${path}/main.exe`,
        JSON.stringify({ ...existing, currentVersion: version })
      );

      break;
    }
    case "DELETE_VERSION": {
      const { id, version } = action.payload;
      const path = `${PROGRAMS_PATH}/${id}`;
      const versionsPath = `${path}/versions`;
      const versionFileName = `${version}.html`;

      // Delete the version file
      await fsManager.delete(`${versionsPath}/${versionFileName}`);

      // If the deleted version was the current version, set the current version to the latest remaining version
      const existingContent = await (
        await fsManager.getFile(`${path}/main.exe`, "deep")
      )?.content;
      const existing = parseProgramConfig(existingContent);
      if (existing.currentVersion === version) {
        const remainingVersions =
          Object.keys(
            (await fsManager.getFolder(versionsPath, "shallow"))?.items ?? {}
          ) ?? [];
        const latestVersion = Math.max(
          ...remainingVersions
            .map((item) => parseInt(item.replace(".html", ""), 10))
            .filter((v) => !isNaN(v))
        );

        // Number.isFinite, not !isNaN: Math.max of an empty version list
        // is -Infinity, which passes !isNaN and would blank index.html
        // and persist currentVersion: -Infinity.
        if (Number.isFinite(latestVersion)) {
          const latestCode = await fsManager.getFile(
            `${versionsPath}/${latestVersion}.html`,
            "deep"
          );
          await fsManager.writeFile(
            `${path}/index.html`,
            latestCode?.content ?? ""
          );
          await fsManager.writeFile(
            `${path}/main.exe`,
            JSON.stringify({ ...existing, currentVersion: latestVersion })
          );
        }
      }

      break;
    }
  }
}

async function addVersion(
  fsManager: Awaited<ReturnType<typeof getFsManager>>,
  programPath: string,
  code: string,
  timestamp: number
): Promise<void> {
  const versionsPath = `${programPath}/versions`;

  // Create versions folder if it doesn't exist
  const folder = await fsManager.getFolder(versionsPath, "shallow");
  if (!folder) {
    await fsManager.createFolder(versionsPath);
  }

  const versionFileName = `${timestamp}.html`;
  await fsManager.writeFile(`${versionsPath}/${versionFileName}`, code);
}

export const programAtomFamily = atomFamily((id: string) =>
  atom(async (get) => {
    const p = await get(programsAtom);
    return p.programs.find((p) => p.id === id);
  })
);

export const programVersionsAtomFamily = atomFamily((id: string) =>
  atom(async (get) => {
    const fsManager = await getFsManager();
    const programPath = `${PROGRAMS_PATH}/${id}`;
    const versionsPath = `${programPath}/versions`;

    const folder = await get(fsManager.getFolderAtom(versionsPath, "shallow"));
    if (!folder) {
      return [];
    }

    return Object.keys(folder.items)
      .filter((file: string) => file.endsWith(".html"))
      .map((file: string) => parseInt(file.replace(".html", ""), 10))
      .sort((a: number, b: number) => b - a); // Sort in descending order (newest first)
  })
);
