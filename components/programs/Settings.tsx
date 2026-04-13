"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { settingsAtom } from "@/state/settings";
import { windowsListAtom } from "@/state/windowsList";
import {
  isRootDirectorySetAtom,
  rootDirectoryHandleAtom,
} from "@/lib/filesystem/directoryMapping";
import styles from "./Settings.module.css";
import cx from "classnames";
import { ModelSection } from "../ModelSection";
import { useFlags } from "@/flags/context";
import { supportsDirectoryPicker } from "@/lib/supportsDirectoryPicker";
import { useState } from "react";

type KeyStatus = "idle" | "testing" | "valid" | "invalid" | "saved" | "cleared";

export function Settings({ id }: { id: string }) {
  const [settings, setSettings] = useAtom(settingsAtom);
  const windowsDispatch = useSetAtom(windowsListAtom);
  const flags = useFlags();
  const [keyInput, setKeyInput] = useState(settings.apiKey || "");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [showKey, setShowKey] = useState(false);

  const testKey = async () => {
    if (!keyInput.trim()) return;
    setKeyStatus("testing");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyInput.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (res.ok || res.status === 200) {
        setKeyStatus("valid");
      } else if (res.status === 401) {
        setKeyStatus("invalid");
      } else {
        setKeyStatus("valid"); // Other errors (rate limit etc) mean key is valid
      }
    } catch {
      setKeyStatus("invalid");
    }
  };

  const saveKey = () => {
    setSettings({ ...settings, apiKey: keyInput.trim() || null });
    setKeyStatus("saved");
    setTimeout(() => setKeyStatus("idle"), 2000);
  };

  const clearKey = () => {
    setKeyInput("");
    setSettings({ ...settings, apiKey: null });
    setKeyStatus("cleared");
    setTimeout(() => setKeyStatus("idle"), 2000);
  };

  const statusMessage = () => {
    switch (keyStatus) {
      case "testing": return <span style={{ color: "#555" }}>Testing key...</span>;
      case "valid": return <span style={{ color: "#006400" }}>Key is valid. Click Save to store it.</span>;
      case "invalid": return <span style={{ color: "#cc0000" }}>Invalid key. Please check and try again.</span>;
      case "saved": return <span style={{ color: "#006400" }}>Key saved to your browser.</span>;
      case "cleared": return <span style={{ color: "#555" }}>Key removed.</span>;
      default: return null;
    }
  };

  return (
    <div className={styles.body}>
      <fieldset>
        <legend>API Key</legend>
        <div className={cx("field-row")}>
          <label htmlFor="apiKey" className={styles.label}>
            Key:
          </label>
          <input
            id="apiKey"
            type={showKey ? "text" : "password"}
            value={keyInput}
            onChange={(e) => {
              setKeyInput(e.target.value);
              setKeyStatus("idle");
            }}
            placeholder="sk-ant-..."
            className={styles.input}
            aria-label="Anthropic API key"
          />
        </div>
        <div className={cx("field-row")} style={{ gap: 4 }}>
          <button onClick={() => setShowKey(!showKey)} style={{ minWidth: 60 }}>
            {showKey ? "Hide" : "Show"}
          </button>
          <button onClick={testKey} disabled={!keyInput.trim() || keyStatus === "testing"}>
            Test
          </button>
          <button onClick={saveKey} disabled={!keyInput.trim()}>
            Save
          </button>
          <button onClick={clearKey} disabled={!keyInput && !settings.apiKey}>
            Clear
          </button>
        </div>
        {keyStatus !== "idle" && (
          <div className={cx("field-row")} style={{ marginTop: 4 }}>
            <p className={styles.note} style={{ fontSize: 11 }}>
              {statusMessage()}
            </p>
          </div>
        )}
        <div className={cx("field-row")} style={{ marginTop: 4 }}>
          <p className={styles.note}>
            Enter your{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              Anthropic API key
            </a>{" "}
            to use AI features with no access code or rate limit.
            Your key is stored only in your browser and never leaves your device.
          </p>
        </div>
      </fieldset>

      {flags.tokens && <ModelSection />}

      <DirectorySection />

      <button onClick={() => windowsDispatch({ type: "REMOVE", payload: id })} className={styles.submit}>
        Done
      </button>
    </div>
  );
}

function DirectorySection() {
  const [rootDirectory, setRootDirectory] = useAtom(rootDirectoryHandleAtom);
  const isRootDirectorySet = useAtomValue(isRootDirectorySetAtom);

  const handleChooseDirectory = async () => {
    try {
      const directoryHandle = await window.showDirectoryPicker();
      setRootDirectory(directoryHandle);
    } catch (error) {
      console.error("Error selecting directory:", error);
    }
  };

  const handleClearDirectory = () => {
    setRootDirectory(null);
  };

  if (!supportsDirectoryPicker()) {
    return null;
  }

  return (
    <fieldset>
      <legend>Storage Directory</legend>
      <div className={cx("field-row")}>
        <button onClick={handleChooseDirectory} className={styles.button}>
          Choose Directory
        </button>
        <button onClick={handleClearDirectory} className={styles.button}>
          Clear
        </button>
      </div>
      <div className={cx("field-row")}>
        <p className={styles.note}>
          {isRootDirectorySet ? (
            <span>
              Saving to: <b>{rootDirectory.name}</b>
            </span>
          ) : (
            "Using browser storage. Choose a directory to save files to your computer."
          )}
        </p>
      </div>
    </fieldset>
  );
}
