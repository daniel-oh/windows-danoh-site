"use client";

import { useEffect, useState, useCallback, useMemo, useDeferredValue } from "react";
import { staleAtom } from "@/lib/staleAtom";
import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from "jotai";
import { focusedWindowAtom } from "@/state/focusedWindow";

import { windowAtomFamily } from "@/state/window";
import { windowsListAtom } from "@/state/windowsList";

import styles from "./Explorer.module.css";
import cx from "classnames";
import { useCreateContextMenu } from "@/state/contextMenu";
import up from "@/components/assets/up.ico";
import paste from "@/components/assets/paste.ico";
import newFolder from "@/components/assets/newDir.png";
import Image from "next/image";
import { fsManagerAtom, getFsManager } from "@/state/fsManager";
import { StubItem } from "@/lib/filesystem/Drive";
import disk from "@/components/assets/disk.png";
import { mountDirectory } from "@/lib/filesystem/directoryMapping";
import { supportsDirectoryPicker } from "@/lib/supportsDirectoryPicker";
import { runProgramFromPath } from "@/lib/runProgramFromPath";
import { createWindow } from "@/lib/createWindow";
import { PROGRAMS } from "@/lib/programs";
import { alert } from "@/lib/alert";

// Shared by every Explorer window, like the real clipboard: copy in one
// window, paste in another.
let explorerClipboard: { action: "copy" | "cut"; path: string } | null = null;

export function Explorer({ id }: { id: string }) {
  const createContextMenu = useCreateContextMenu();
  const [state, dispatch] = useAtom(windowAtomFamily(id));
  const windowListDispatch = useSetAtom(windowsListAtom);
  const fs = useAtomValue(fsManagerAtom);

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState<string>("");
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  if (state.program.type !== "explorer") {
    throw new Error("Program is not explorer");
  }
  const { action, actionText } = state.program;
  const currentPath = state.program.currentPath || "/";
  const [inputPath, setInputPath] = useState(state.program.currentPath || "");
  // Never blank the list. A change inside the folder swaps rows in place
  // (staleAtom keeps the last listing while the new one loads), and
  // opening another folder keeps showing this one until that one is read:
  // the deferred path renders in the background, so its first load
  // suspends there instead of behind next/dynamic's null fallback.
  const listedPath = useDeferredValue(currentPath);
  const folderAtom = useMemo(
    () => staleAtom(fs.getFolderAtom(listedPath, "shallow")),
    [fs, listedPath]
  );
  const currentFolder = useAtomValue(folderAtom);

  // "Adjust state when props change" per the React docs: a render-phase
  // setState (not an effect) so the address bar resyncs to navigation
  // without an extra commit.
  const [prevPath, setPrevPath] = useState(currentPath);
  if (prevPath !== currentPath) {
    setPrevPath(currentPath);
    setInputPath(currentPath || "/");
  }

  const handleDoubleClick = async (path: string) => {
    const fs = await getFsManager();
    const item = await fs.getItem(path, "shallow");
    if (item?.type === "folder") {
      dispatch({
        type: "UPDATE_PROGRAM",
        payload: { type: "explorer", currentPath: path },
      });
    }

    if (item?.type === "file") {
      if (action) {
        action(path);
        windowListDispatch({
          type: "REMOVE",
          payload: id,
        });
      } else if (item.name.endsWith(".exe")) {
        runProgramFromPath(path);
      } else if (/\.(wav|mp3|m4a|ogg|flac|aac)$/i.test(item.name)) {
        // Audio opens in the Sampler, on a pad, the way a .exe opens as a
        // program. This is also the other half of the Sampler's Export.
        createWindow({
          ...PROGRAMS.sampler,
          title: `Sampler - ${item.name}`,
          program: { type: "sampler", loadPath: path },
        });
      }
    }
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPath(e.target.value);
  };

  const handlePathSubmit = async () => {
    try {
      const fs = await getFsManager();
      const folder = await fs.getFolder(inputPath, "shallow");
      if (!folder) {
        return;
      }
      dispatch({
        type: "UPDATE_PROGRAM",
        payload: { type: "explorer", currentPath: inputPath },
      });
    } catch {}
  };

  const handleNavigateUp = async () => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/");
    try {
      const fs = await getFsManager();
      const folder = await fs.getFolder(parentPath, "shallow");
      if (!folder) {
        return;
      }
      dispatch({
        type: "UPDATE_PROGRAM",
        payload: { type: "explorer", currentPath: parentPath },
      });
    } catch {
      alert({ message: "Cannot navigate up from the current path", icon: "x" });
    }
  };

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewFileName(e.target.value);
  };

  const handleFileSave = async () => {
    if (newFileName.trim() === "") {
      alert({ message: "File name cannot be empty", icon: "x" });
      return;
    }
    // Awaited, and the dialog stays open if it fails: it used to close
    // straight away whether or not the file was written.
    try {
      await action!(`${currentPath}/${newFileName}`);
    } catch {
      alert({ message: "Could not save the file. Try again.", icon: "x" });
      return;
    }
    windowListDispatch({
      type: "REMOVE",
      payload: id,
    });
  };

  const handleNewFolder = () => {
    setIsCreatingFolder(true);
    setNewFileName("");
  };

  const handleNewFolderSubmit = async () => {
    if (newFileName.trim() === "") {
      setIsCreatingFolder(false);
      return;
    }
    try {
      const newFolderPath = `${currentPath}/${newFileName}`;
      const fs = await getFsManager();
      await fs.createFolder(newFolderPath);
      setIsCreatingFolder(false);
      setSelectedItem(newFolderPath);
    } catch (error) {
      alert({ message: "Failed to create folder", icon: "x" });
    }
  };

  const handleClick = (path: string) => {
    setSelectedItem(path);
    setNewFileName(path.split("/").pop() || "");
  };

  const handleRename = (oldPath: string) => {
    setIsRenaming(true);
    setSelectedItem(oldPath);
    setNewFileName(oldPath.split("/").pop() || "");
  };

  const handleRenameSubmit = async () => {
    if (
      newFileName.trim() === "" ||
      newFileName === selectedItem?.split("/").pop()
    ) {
      setIsRenaming(false);
      return;
    }
    try {
      const oldPath = selectedItem!;
      const newPath = `${currentPath}/${newFileName}`;
      const fs = await getFsManager();
      // Renaming onto an existing name used to replace that file.
      if (await fs.getItem(newPath, "shallow")) {
        alert({ message: `There is already an item named ${newFileName}.`, icon: "x" });
        return;
      }
      await fs.move(oldPath, newPath);
      setIsRenaming(false);
      setSelectedItem(newPath);
    } catch (error) {
      alert({ message: "Failed to rename item", icon: "x" });
    }
  };

  // Copy and Cut remember a path; nothing is read or removed until Paste.
  // They used to put the item, as text, on the system clipboard, and Cut
  // deleted it at once: the clipboard was then the only copy (the next
  // Ctrl+C anywhere lost it) and anything that was not text came back
  // corrupted.
  const handleCopy = useCallback((path: string) => {
    explorerClipboard = { action: "copy", path };
  }, []);

  const handleCut = useCallback((path: string) => {
    explorerClipboard = { action: "cut", path };
  }, []);

  const handlePaste = useCallback(async () => {
    const clip = explorerClipboard;
    if (!clip) return;
    try {
      const fs = await getFsManager();
      if (!(await fs.getItem(clip.path, "shallow"))) {
        explorerClipboard = null;
        alert({ message: "The item you copied is no longer there.", icon: "x" });
        return;
      }
      const name = clip.path.split("/").pop() || "item";
      if (currentPath === clip.path || currentPath.startsWith(`${clip.path}/`)) {
        alert({ message: "A folder cannot be pasted inside itself.", icon: "x" });
        return;
      }

      let newPath = `${currentPath}/${name}`;
      let counter = 1;
      while (await fs.getItem(newPath, "shallow")) {
        const nameParts = name.split(".");
        if (nameParts.length > 1) {
          const extension = nameParts.pop();
          newPath = `${currentPath}/${nameParts.join(".")}_${counter}.${extension}`;
        } else {
          newPath = `${currentPath}/${name}_${counter}`;
        }
        counter++;
      }

      await fs.copy(clip.path, newPath);
      // A cut is only removed once the paste has landed.
      if (clip.action === "cut") {
        await fs.delete(clip.path);
        explorerClipboard = null;
      }
      setSelectedItem(newPath);
    } catch (error) {
      console.error("Failed to paste:", error);
      alert({ message: "Failed to paste item", icon: "x" });
    }
  }, [currentPath]);

  const handleMount = useCallback(async () => {
    try {
      const directoryHandle = await window.showDirectoryPicker();
      // The picked folder already has a name — no need for a prompt()
      // (which would also break the Win98 chrome with a native dialog).
      await mountDirectory(directoryHandle.name, directoryHandle);
      // Refresh the current folder view
      dispatch({
        type: "UPDATE_PROGRAM",
        payload: { type: "explorer", currentPath },
      });
    } catch (error) {
      // Closing the picker rejects with AbortError — that's a cancel,
      // not a failure.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("Failed to mount directory:", error);
      alert({ message: "Failed to mount directory", icon: "x" });
    }
  }, [dispatch, currentPath]);

  const handleUnmount = useCallback(
    async (mountName: string) => {
      try {
        await mountDirectory(mountName, null);
        // Refresh the current folder view
        dispatch({
          type: "UPDATE_PROGRAM",
          payload: { type: "explorer", currentPath },
        });
      } catch (error) {
        console.error("Failed to unmount directory:", error);
        alert({ message: "Failed to unmount directory", icon: "x" });
      }
    },
    [dispatch, currentPath]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      // The listener is global, so without these guards ANY open
      // Explorer (even minimized) hijacks copy/paste everywhere:
      // Ctrl+C while copying text in another window replaces the
      // clipboard with FS JSON, and Ctrl+X deletes the selected file.
      if (getDefaultStore().get(focusedWindowAtom) !== id) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case "c":
          if (selectedItem) handleCopy(selectedItem);
          break;
        case "x":
          if (selectedItem) handleCut(selectedItem);
          break;
        case "v":
          handlePaste();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, selectedItem, handleCopy, handleCut, handlePaste]);

  const renderItems = (items: Record<string, StubItem>, path: string) => {
    const paths = Object.keys(items).map((k) => `${path}/${items[k].name}`.replace("//", "/"));
    // One Tab stop for the whole list (the selected row, else the first);
    // arrows move within it. Every row used to be its own Tab stop.
    const tabStop = selectedItem && paths.includes(selectedItem) ? selectedItem : paths[0];
    return Object.keys(items).map((key) => {
      const item = items[key];
      const itemPath = `${path}/${item.name}`.replace("//", "/");
      const isMount = path === "/mnt" && item.type === "folder";

      return (
        <tr
          key={key}
          onDoubleClick={() => handleDoubleClick(itemPath)}
          className={cx({ highlighted: selectedItem === itemPath })}
          onClick={() => handleClick(itemPath)}
          // Rows were mouse-only: no way to select, open or rename from
          // the keyboard (including the Save/Open pickers). Enter opens,
          // Space selects, arrows move between rows.
          tabIndex={itemPath === tabStop ? 0 : -1}
          // aria-selected is not allowed on a plain table row; aria-current is.
          aria-current={selectedItem === itemPath ? "true" : undefined}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return; // rename <input>
            if (e.key === "Enter") {
              e.preventDefault();
              handleDoubleClick(itemPath);
            } else if (e.key === " ") {
              e.preventDefault();
              handleClick(itemPath);
            } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const row = e.currentTarget;
              const next =
                e.key === "ArrowDown"
                  ? row.nextElementSibling
                  : row.previousElementSibling;
              (next as HTMLElement | null)?.focus();
            }
          }}
          {...createContextMenu([
            {
              label: "Delete",
              // No Recycle Bin for files, so confirm before wiping.
              onClick: () =>
                alert({
                  alertId: `DELETE_FILE_${itemPath}`,
                  title: "Confirm Delete",
                  message: `Delete "${item.name}"? This can't be undone.`,
                  actions: [
                    { label: "Cancel", callback: (close) => close() },
                    {
                      label: "Delete",
                      callback: async (close) => {
                        close();
                        const fs = await getFsManager();
                        await fs.delete(itemPath);
                      },
                    },
                  ],
                }),
            },
            {
              label: "Rename",
              onClick: () => handleRename(itemPath),
            },
            {
              label: "Copy",
              onClick: () => handleCopy(itemPath),
            },
            {
              label: "Cut",
              onClick: () => handleCut(itemPath),
            },
            ...(isMount
              ? [
                  {
                    label: "Unmount",
                    onClick: () => handleUnmount(item.name),
                  },
                ]
              : []),
          ])}
        >
          <td>{item.type === "folder" ? "📁" : "📄"}</td>
          <td>
            {isRenaming && selectedItem === itemPath ? (
              <input
                type="text"
                aria-label="Name"
                value={newFileName}
                onChange={handleFileNameChange}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameSubmit();
                  }
                }}
                autoFocus
              />
            ) : (
              item.name
            )}
          </td>
        </tr>
      );
    });
  };

  const currentItems = currentFolder ? currentFolder.items : {};

  const canMountDirectory = supportsDirectoryPicker();

  return (
    <div className={styles.explorer}>
      <div className={styles.actions}>
        {/* alt="" on the glyphs: the visible label already names each
         * button, so a non-empty alt read as "Up Up". */}
        <button onClick={handleNavigateUp}>
          <Image src={up} alt="" />
          <span>Up</span>
        </button>
        <button onClick={handleNewFolder}>
          <Image src={newFolder} alt="" />
          <span>New Folder</span>
        </button>
        <button onClick={handlePaste}>
          <Image src={paste} alt="" />
          <span>Paste</span>
        </button>
        {canMountDirectory && (
          <button onClick={handleMount}>
            <Image src={disk} alt="" />
            <span>Mount</span>
          </button>
        )}
      </div>
      <div className={styles.pathBar}>
        <label>Address:</label>
        <input
          type="text"
          aria-label="Path"
          value={inputPath}
          onChange={handlePathChange}
          onBlur={handlePathSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handlePathSubmit();
            }
          }}
        />
      </div>
      <div className={cx("sunken-panel", styles.tableWrapper)}>
        <table className="interactive">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {/* listedPath, not currentPath: for a moment after a click these
                rows are still the previous folder's. */}
            {renderItems(currentItems, listedPath)}
            {Object.keys(currentItems).length === 0 && !isCreatingFolder && (
              <tr>
                <td colSpan={2} style={{ color: "#666", padding: "10px 8px" }}>
                  This folder is empty.
                </td>
              </tr>
            )}
            {isCreatingFolder && (
              <tr>
                <td>📁</td>
                <td>
                  <input
                    type="text"
                    aria-label="Name"
                    value={newFileName}
                    onChange={handleFileNameChange}
                    onBlur={handleNewFolderSubmit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleNewFolderSubmit();
                      }
                    }}
                    autoFocus
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {action && (
        <div className={styles.saveSection}>
          <label>File Name:</label>
          <input
            type="text"
            aria-label="Name"
            value={newFileName}
            onChange={handleFileNameChange}
          />
          <button onClick={handleFileSave}>{actionText}</button>
        </div>
      )}
    </div>
  );
}
