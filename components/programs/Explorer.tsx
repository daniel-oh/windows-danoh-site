"use client";

import { useEffect, useState, useCallback } from "react";
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
import { alert } from "@/lib/alert";

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
  const currentFolder = useAtomValue(fs.getFolderAtom(currentPath, "shallow"));

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

  const handleFileSave = () => {
    if (newFileName.trim() === "") {
      alert({ message: "File name cannot be empty", icon: "x" });
      return;
    }
    action!(`${currentPath}/${newFileName}`);
    // Close this window
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
      await fs.move(oldPath, newPath);
      setIsRenaming(false);
      setSelectedItem(newPath);
    } catch (error) {
      alert({ message: "Failed to rename item", icon: "x" });
    }
  };

  const handleCopy = useCallback(async (path: string) => {
    try {
      const fs = await getFsManager();
      const item = await fs.getItem(path, "deep");
      if (item) {
        await navigator.clipboard.writeText(
          JSON.stringify({ action: "copy", item })
        );
      }
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  }, []);

  const handleCut = useCallback(async (path: string) => {
    try {
      const fs = await getFsManager();
      const item = await fs.getItem(path, "deep");
      if (item) {
        await navigator.clipboard.writeText(
          JSON.stringify({ action: "cut", item })
        );
        await fs.delete(path);
      }
    } catch (error) {
      console.error("Failed to cut to clipboard:", error);
    }
  }, []);

  const handlePaste = useCallback(async () => {
    try {
      const clipboardContent = await navigator.clipboard.readText();
      const { action, item } = JSON.parse(clipboardContent);

      let newPath = `${currentPath}/${item.name}`;
      let counter = 1;

      const fs = await getFsManager();

      while (await fs.getItem(newPath, "shallow")) {
        const nameParts = item.name.split(".");
        if (nameParts.length > 1) {
          const extension = nameParts.pop();
          newPath = `${currentPath}/${nameParts.join(
            "."
          )}_${counter}.${extension}`;
        } else {
          newPath = `${currentPath}/${item.name}_${counter}`;
        }
        counter++;
      }

      if (action === "copy" || action === "cut") {
        await fs.insert(newPath, item);
      }
    } catch (error) {
      console.error("Failed to paste from clipboard:", error);
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
          {...createContextMenu([
            {
              label: "Delete",
              onClick: async () => {
                const fs = await getFsManager();
                await fs.delete(itemPath);
              },
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
        <button onClick={handleNavigateUp}>
          <Image src={up} alt="Up" />
          <span>Up</span>
        </button>
        <button onClick={handleNewFolder}>
          <Image src={newFolder} alt="New Folder" />
          <span>New Folder</span>
        </button>
        <button onClick={handlePaste}>
          <Image src={paste} alt="Paste" />
          <span>Paste</span>
        </button>
        {canMountDirectory && (
          <button onClick={handleMount}>
            <Image src={disk} alt="Mount" />
            <span>Mount</span>
          </button>
        )}
      </div>
      <div className={styles.pathBar}>
        <label>Address:</label>
        <input
          type="text"
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
            {renderItems(currentItems, currentPath)}
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
            value={newFileName}
            onChange={handleFileNameChange}
          />
          <button onClick={handleFileSave}>{actionText}</button>
        </div>
      )}
    </div>
  );
}
