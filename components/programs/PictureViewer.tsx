"use client";

import { useEffect, useState } from "react";
import { getFsManager } from "@/state/fsManager";
import { DESCRIBED_PICTURES } from "@/lib/seedPictures";
import styles from "./PictureViewer.module.css";

// Opens a picture from the site's file system: Camera snaps, the photo in
// My Pictures, anything a visitor copies in. Explorer had no way to show
// an image, so Camera saved pictures nobody could open here.

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

type Loaded = { url: string } | { error: string } | null;

export function PictureViewer({ path }: { path: string }) {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const name = path.split("/").pop() ?? path;

  useEffect(() => {
    let live = true;
    let url: string | null = null;
    (async () => {
      const fs = await getFsManager();
      const bytes = await fs.readBytes(path).catch(() => null);
      if (!live) return;
      if (!bytes) {
        setLoaded({ error: `${name} could not be found. It may have been moved or deleted.` });
        return;
      }
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      url = URL.createObjectURL(new Blob([bytes], { type: MIME[ext] ?? "application/octet-stream" }));
      setLoaded({ url });
    })();
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, name]);

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        {loaded && "url" in loaded && (
          // eslint-disable-next-line @next/next/no-img-element -- a blob URL from the visitor's own file system
          <img
            src={loaded.url}
            alt={DESCRIBED_PICTURES[path] ?? name}
            className={styles.picture}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setLoaded({ error: `${name} is not a picture this browser can show.` })}
          />
        )}
        {loaded && "error" in loaded && <p className={styles.message}>{loaded.error}</p>}
      </div>
      <div className="status-bar">
        <p className="status-bar-field">{name}</p>
        <p className={`status-bar-field ${styles.dims}`}>{size ? `${size.w} x ${size.h}` : ""}</p>
      </div>
    </div>
  );
}
