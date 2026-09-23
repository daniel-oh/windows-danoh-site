import { RealFs } from "../RealFs";
import { getOriginPrivateDirectory } from "file-system-access";

describe("RealFs.createFile", () => {
  it("keeps the old contents when a write fails, and says so", async () => {
    const root = await getOriginPrivateDirectory(
      import("file-system-access/lib/adapters/memory.js")
    );
    const dir = await root.getDirectoryHandle("realfs-abort", { create: true });
    const fs = new RealFs(dir);
    await fs.createFile("registry.json", '{"a":1}');
    // A write that throws midway stands in for a disk that fills up.
    const failing = {
      get type(): string {
        throw new Error("disk full");
      },
    } as unknown as string;
    await expect(fs.createFile("registry.json", failing)).rejects.toThrow("disk full");
    expect(await fs.readFile("registry.json")).toBe('{"a":1}');
  });
});
