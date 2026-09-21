import { createStore } from "jotai";
import { getOriginPrivateDirectory } from "file-system-access";
import { FsManager } from "../FsManager";
import { staleAtom } from "../../staleAtom";

async function manager() {
  const handle = await getOriginPrivateDirectory(
    import("file-system-access/lib/adapters/memory.js")
  );
  const fs = new FsManager(handle);
  await fs.setupDefaultDirectories();
  return fs;
}

// Let the fire-and-forget checks after a write run to completion.
const settle = () => new Promise((r) => setTimeout(r, 30));

describe("FsManager watchers", () => {
  test("a write elsewhere does not refresh an unchanged folder", async () => {
    const fs = await manager();
    const store = createStore();
    const folder = fs.getFolderAtom("/user", "shallow");
    const unsub = store.sub(folder, () => {});
    const first = store.get(folder);
    await first;

    await fs.writeFile("/system/elsewhere.txt", "x");
    await settle();

    // Same promise: readers see no change and nothing suspends.
    expect(store.get(folder)).toBe(first);
    unsub();
  });

  test("a write into the folder refreshes it with the new file", async () => {
    const fs = await manager();
    const store = createStore();
    const folder = fs.getFolderAtom("/user", "shallow");
    const unsub = store.sub(folder, () => {});
    const first = store.get(folder);
    expect(Object.keys((await first)?.items ?? {})).not.toContain("snap.png");

    await fs.writeFile("/user/snap.png", new ArrayBuffer(4));
    await settle();

    const next = store.get(folder);
    expect(next).not.toBe(first);
    expect(Object.keys((await next)?.items ?? {})).toContain("snap.png");
    unsub();
  });

  test("staleAtom keeps the last value while the folder reloads", async () => {
    const fs = await manager();
    const store = createStore();
    const view = staleAtom(fs.getFolderAtom("/user", "shallow"));
    const unsub = store.sub(view, () => {});

    // First read suspends like any async atom.
    const initial = store.get(view);
    expect(initial).toBeInstanceOf(Promise);
    const loaded = await initial;
    await settle();

    // From then on it is a plain value, never a pending promise, even
    // across a change.
    const before = store.get(view);
    expect(before).not.toBeInstanceOf(Promise);
    expect(before).toEqual(loaded);

    await fs.writeFile("/user/new.txt", "hello");
    // Mid-reload: still the previous listing, not a promise.
    expect(store.get(view)).not.toBeInstanceOf(Promise);
    await settle();
    const after = store.get(view) as Awaited<typeof loaded>;
    expect(Object.keys(after?.items ?? {})).toContain("new.txt");
    unsub();
  });
});
