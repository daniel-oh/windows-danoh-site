import {
  Drive,
  StubFile,
  DeepFile,
  DeepFolder,
  ShallowFolder,
  Depth,
} from "./Drive";
import { RealFs } from "./RealFs";
import { atomWithRefresh } from "jotai/utils";
import { atomFamily } from "jotai-family";
import {
  SYSTEM_PATH,
  PROGRAMS_PATH,
  USER_PATH,
  REGISTRY_PATH,
} from "@/lib/filesystem/defaultFileSystem";

// The atoms below watch the filesystem for changes made outside
// FsManager: a mounted real folder edited in Finder, another tab. Writes
// made through FsManager check at once (see notifyWrite), so this poll
// is only the fallback and can be slow.
const POLL_INTERVAL = 5000;

function whileVisible(tick: () => void) {
  let interval: ReturnType<typeof setInterval> | null = null;
  const start = () => {
    if (!interval) interval = setInterval(tick, POLL_INTERVAL);
  };
  const stop = () => {
    if (interval) clearInterval(interval);
    interval = null;
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  if (typeof document !== "undefined") {
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    stop();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

export class FsManager {
  private rootDrive: Drive;
  private mountedDrives: { [name: string]: Drive } = {};
  /** One entry per mounted atom: re-read now, refresh only if changed. */
  private checks = new Set<() => Promise<void>>();

  // An async atom that re-reads in the background and refreshes only
  // when the result differs. The old version refreshed on every tick,
  // which handed React a new pending promise every 2s: every reader
  // suspended, and the Explorer, whose nearest Suspense boundary is
  // next/dynamic's null fallback, blanked its file list each time.
  private watched<T>(read: () => Promise<T>, forget: () => void) {
    let last: string | undefined;
    // A read the background check already did, handed to the getter so
    // a change costs one read, not two.
    let stash: { value: T } | null = null;
    const base = atomWithRefresh(async () => {
      if (stash) {
        const { value } = stash;
        stash = null;
        return value;
      }
      const value = await read();
      last = JSON.stringify(value);
      return value;
    });
    base.onMount = (refresh: () => void) => {
      let busy = false;
      // A write that lands while a read is in flight may not be in that
      // read, so it earns one more pass as soon as the current one ends.
      let again = false;
      const check = async () => {
        if (busy) {
          again = true;
          return;
        }
        busy = true;
        try {
          do {
            again = false;
            try {
              const value = await read();
              const sig = JSON.stringify(value);
              if (sig !== last) {
                last = sig;
                stash = { value };
                refresh();
              }
            } catch {
              // A read that fails (a folder mid-delete) is retried next tick.
            }
          } while (again);
        } finally {
          busy = false;
        }
      };
      this.checks.add(check);
      const stop = whileVisible(check);
      return () => {
        this.checks.delete(check);
        stop();
        // Out of the family cache so it can be GC'd.
        forget();
      };
    };
    return base;
  }

  /** After a write through FsManager, bring every watcher up to date now
   * instead of at the next poll. Not awaited: writers do not wait on
   * readers. */
  private notifyWrite() {
    for (const check of this.checks) void check();
  }

  private shallowAtoms = atomFamily((path: string) =>
    this.watched(
      () => this.getFolder(path, "shallow"),
      () => this.shallowAtoms.remove(path)
    )
  );

  private deepAtoms = atomFamily((path: string) =>
    this.watched(
      () => this.getFolder(path, "deep"),
      () => this.deepAtoms.remove(path)
    )
  );

  private fileAtoms = atomFamily((path: string) =>
    this.watched(
      () => this.getFile(path, "deep"),
      () => this.fileAtoms.remove(path)
    )
  );

  constructor(
    rootHandle: FileSystemDirectoryHandle,
    mountedDrives: { [name: string]: FileSystemDirectoryHandle } = {}
  ) {
    this.rootDrive = new Drive(new RealFs(rootHandle));

    // Mount drives passed in the constructor
    for (const [name, handle] of Object.entries(mountedDrives)) {
      this.mountedDrives[name] = new Drive(new RealFs(handle));
    }

    this.setupDefaultDirectories();
  }

  public async setupDefaultDirectories(): Promise<void> {
    const defaultDirs = [SYSTEM_PATH, PROGRAMS_PATH, USER_PATH];
    for (const dir of defaultDirs) {
      const exists = await this.getFolder(dir, "shallow");
      if (!exists) {
        await this.createFolder(dir);
      }
    }

    // Create registry file if it doesn't exist
    const registryExists = await this.getFile(REGISTRY_PATH, "shallow");
    if (!registryExists) {
      await this.writeFile(REGISTRY_PATH, "{}");
    }
  }

  public async hasSystemData(): Promise<boolean> {
    const system = await this.getFolder(SYSTEM_PATH, "shallow");
    return !!system;
  }

  async writeFile(path: string, content: string | ArrayBuffer): Promise<void> {
    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      await mountedDrive.writeFile(this.getRelativePath(path), content);
    } else {
      await this.rootDrive.writeFile(path, content);
    }
    this.notifyWrite();
  }

  async createFolder(path: string): Promise<void> {
    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      await mountedDrive.createFolder(this.getRelativePath(path));
    } else {
      await this.rootDrive.createFolder(path);
    }
    this.notifyWrite();
  }

  async delete(path: string): Promise<void> {
    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      await mountedDrive.delete(this.getRelativePath(path));
    } else {
      await this.rootDrive.delete(path);
    }
    this.notifyWrite();
  }

  async getItem(
    path: string,
    depth: "shallow"
  ): Promise<StubFile | ShallowFolder | null>;
  async getItem(
    path: string,
    depth: "deep"
  ): Promise<DeepFile | DeepFolder | null>;
  async getItem(
    path: string,
    depth: Depth = "shallow"
  ): Promise<StubFile | ShallowFolder | DeepFile | DeepFolder | null> {
    if (path === "/mnt") {
      return this.getMntFolder(depth);
    }

    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      const relativePath = this.getRelativePath(path);
      return mountedDrive.getItem(relativePath, depth as any);
    }

    return this.rootDrive.getItem(path, depth as any);
  }

  async getFolder(
    path: string,
    depth: "shallow"
  ): Promise<ShallowFolder | null>;
  async getFolder(path: string, depth: "deep"): Promise<DeepFolder | null>;
  async getFolder(
    path: string,
    depth: Depth = "shallow"
  ): Promise<ShallowFolder | DeepFolder | null> {
    if (path === "/") {
      // Handle root directory
      const rootFolder = await this.rootDrive.getFolder(path, depth as any);
      if (rootFolder && Object.keys(this.mountedDrives).length > 0) {
        // Add "mnt" folder to the root directory
        rootFolder.items["mnt"] = await this.getMntFolder(depth);
      }
      return rootFolder;
    }

    if (path === "/mnt") {
      return this.getMntFolder(depth);
    }

    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      const relativePath = this.getRelativePath(path);
      return mountedDrive.getFolder(relativePath, depth as any);
    }
    return this.rootDrive.getFolder(path, depth as any);
  }

  async getFile(path: string, depth: "shallow"): Promise<StubFile | null>;
  async getFile(path: string, depth: "deep"): Promise<DeepFile | null>;
  async getFile(
    path: string,
    depth: Depth = "shallow"
  ): Promise<StubFile | DeepFile | null> {
    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      const relativePath = this.getRelativePath(path);
      return mountedDrive.getFile(relativePath, depth as any);
    }
    return this.rootDrive.getFile(path, depth as any);
  }

  /** A file's bytes, for the things that are not text. */
  async readBytes(path: string): Promise<ArrayBuffer | null> {
    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      return mountedDrive.readBytes(this.getRelativePath(path));
    }
    return this.rootDrive.readBytes(path);
  }

  async insert(path: string, item: DeepFolder | DeepFile): Promise<void> {
    const mountedDrive = this.getMountedDriveForPath(path);
    if (mountedDrive) {
      await mountedDrive.insert(this.getRelativePath(path), item);
    } else {
      await this.rootDrive.insert(path, item);
    }
    this.notifyWrite();
  }

  async move(oldPath: string, newPath: string): Promise<void> {
    const mountedDrive = this.getMountedDriveForPath(oldPath);
    if (mountedDrive) {
      await mountedDrive.move(
        this.getRelativePath(oldPath),
        this.getRelativePath(newPath)
      );
    } else {
      await this.rootDrive.move(oldPath, newPath);
    }
    this.notifyWrite();
  }

  getFolderAtom(
    path: string,
    depth: "shallow"
  ): ReturnType<typeof atomWithRefresh<Promise<ShallowFolder | null>>>;
  getFolderAtom(
    path: string,
    depth: "deep"
  ): ReturnType<typeof atomWithRefresh<Promise<DeepFolder | null>>>;
  getFolderAtom(
    path: string,
    depth: Depth = "shallow"
  ): ReturnType<
    typeof atomWithRefresh<Promise<ShallowFolder | DeepFolder | null>>
  > {
    const atomFamily = depth === "shallow" ? this.shallowAtoms : this.deepAtoms;
    return atomFamily(path);
  }

  getFileAtom(
    path: string
  ): ReturnType<typeof atomWithRefresh<Promise<DeepFile | null>>> {
    return this.fileAtoms(path);
  }

  private getMountedDriveForPath(path: string): Drive | null {
    const parts = path.split("/");
    if (parts[1] === "mnt" && parts[2]) {
      return this.mountedDrives[parts[2]] || null;
    }
    return null;
  }

  private getRelativePath(path: string): string {
    const parts = path.split("/");
    return "/" + parts.slice(3).join("/");
  }

  private async getMntFolder(
    depth: Depth
  ): Promise<ShallowFolder | DeepFolder> {
    const mntFolder: ShallowFolder | DeepFolder = {
      type: "folder",
      name: "mnt",
      items: {},
    };

    if (depth === "deep") {
      for (const [name, drive] of Object.entries(this.mountedDrives)) {
        const driveFolder = await drive.getFolder("/", "deep");
        if (driveFolder) {
          driveFolder.name = name; // Update the name to match the mounted drive name
          mntFolder.items[name] = driveFolder;
        }
      }
    } else {
      mntFolder.items = Object.fromEntries(
        Object.keys(this.mountedDrives).map((name) => [
          name,
          {
            type: "folder" as const,
            name,
          },
        ])
      );
    }

    return mntFolder;
  }
}
