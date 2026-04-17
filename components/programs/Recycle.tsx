"use client";

import { useAtom } from "jotai";
import { recycleBinAtom, type RecycleBinEntry } from "@/state/recycleBin";
import { createWindow } from "@/lib/createWindow";

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return "just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

export function Recycle() {
  const [entries, setEntries] = useAtom(recycleBinAtom);

  const restore = (entry: RecycleBinEntry) => {
    createWindow({
      title: entry.title,
      program: entry.program,
      size: entry.size,
      icon: entry.icon,
    });
    // Remove the restored entry from the bin
    setEntries((prev) => prev.filter((e) => e.binId !== entry.binId));
  };

  const remove = (binId: string) => {
    setEntries((prev) => prev.filter((e) => e.binId !== binId));
  };

  const empty = () => {
    setEntries([]);
  };

  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flex: 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #808080",
          paddingBottom: 6,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">
          🗑️
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "bold" }}>Recycle Bin</div>
          <div style={{ fontSize: 11, color: "#555" }}>
            Recently closed windows. Restore to bring them back.
          </div>
        </div>
        <button
          type="button"
          onClick={empty}
          disabled={entries.length === 0}
          aria-label="Empty the recycle bin"
        >
          Empty
        </button>
      </div>

      <div
        style={{
          overflow: "auto",
          flex: 1,
          minHeight: 80,
        }}
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <div
            style={{
              padding: "24px 8px",
              fontSize: 12,
              color: "#555",
              textAlign: "center",
            }}
          >
            The recycle bin is empty.
          </div>
        ) : (
          <ul
            style={{ listStyle: "none", padding: 0, margin: 0 }}
            role="list"
            aria-label="Recently closed windows"
          >
            {entries.map((entry) => (
              <li
                key={entry.binId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 4px",
                  borderBottom: "1px dashed #aaa",
                }}
              >
                {entry.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.icon}
                    alt=""
                    width={20}
                    height={20}
                    style={{
                      imageRendering: "pixelated",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                    }}
                  >
                    📄
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#555" }}>
                    closed {relTime(entry.closedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => restore(entry)}
                  aria-label={`Restore ${entry.title}`}
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => remove(entry.binId)}
                  aria-label={`Delete ${entry.title} permanently`}
                  title="Delete permanently"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
