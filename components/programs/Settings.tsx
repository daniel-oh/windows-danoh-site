"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  settingsAtom,
  isApiKeyRemembered,
  setApiKeyRemembered,
} from "@/state/settings";
import { testAnthropicKey } from "@/lib/testAnthropicKey";
import { windowsListAtom } from "@/state/windowsList";
import {
  isRootDirectorySetAtom,
  rootDirectoryHandleAtom,
} from "@/lib/filesystem/directoryMapping";
import styles from "./Settings.module.css";
import cx from "classnames";
import { supportsDirectoryPicker } from "@/lib/supportsDirectoryPicker";
import { useState } from "react";
import { loadPosthog } from "@/lib/posthogLazy";
import {
  isAnalyticsOptedOut,
  setAnalyticsOptedOut,
} from "@/lib/analyticsOptOut";
import { isStartupSoundOn, setStartupSoundOn } from "@/lib/startupSound";

type KeyStatus = "idle" | "testing" | "valid" | "invalid" | "saved" | "cleared";

export function Settings({ id }: { id: string }) {
  const [settings, setSettings] = useAtom(settingsAtom);
  const windowsDispatch = useSetAtom(windowsListAtom);
  const [keyInput, setKeyInput] = useState(settings.apiKey || "");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [showKey, setShowKey] = useState(false);

  const [rememberKey, setRememberKey] = useState(() => isApiKeyRemembered());

  const testKey = async () => {
    if (!keyInput.trim()) return;
    setKeyStatus("testing");
    setKeyStatus(await testAnthropicKey(keyInput.trim()));
  };

  const saveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    // Validate before storing — saving a key that fails auth is never
    // what anyone wants, and it would silently break the next
    // generation. Test stays available as the standalone check.
    setKeyStatus("testing");
    if ((await testAnthropicKey(trimmed)) !== "valid") {
      setKeyStatus("invalid");
      return;
    }
    setSettings({ ...settings, apiKey: trimmed });
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
      case "testing": return <span style={{ color: "#444" }}>Testing key...</span>;
      case "valid": return <span style={{ color: "#005400" }}>Key is valid. Click Save to store it.</span>;
      case "invalid": return <span style={{ color: "#a00000" }}>Invalid key. Please check and try again.</span>;
      case "saved": return <span style={{ color: "#005400" }}>Key saved to your browser.</span>;
      case "cleared": return <span style={{ color: "#444" }}>Key removed.</span>;
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
            onKeyDown={(e) => {
              // Enter is the obvious, safe default: validate the key.
              if (e.key === "Enter" && keyInput.trim()) {
                e.preventDefault();
                void testKey();
              }
            }}
            placeholder="sk-ant-..."
            className={styles.input}
            aria-label="Anthropic API key"
          />
        </div>
        <div className={cx("field-row")} style={{ gap: 4 }}>
          <button onClick={() => setShowKey(!showKey)} style={{ minWidth: 60 }} aria-label={showKey ? "Hide API key" : "Show API key"}>
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
          <div
            className={cx("field-row")}
            style={{ marginTop: 4 }}
            role="status"
          >
            <p className={styles.note} style={{ fontSize: 11 }}>
              {statusMessage()}
            </p>
          </div>
        )}
        <div className={cx("field-row")} style={{ marginTop: 4 }}>
          <input
            id="remember-key"
            type="checkbox"
            checked={rememberKey}
            onChange={(e) => {
              setRememberKey(e.target.checked);
              setApiKeyRemembered(e.target.checked, settings.apiKey);
            }}
          />
          <label htmlFor="remember-key">
            Remember key on this device
          </label>
        </div>
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
            Your key is stored only in your browser. It travels with your
            own generation requests, is used for that call, and is never
            stored on the server. It clears when this tab closes unless
            you tick Remember.
          </p>
        </div>
      </fieldset>

      <DirectorySection />

      <DisplaySection />
      <AnalyticsSection />

      <button onClick={() => windowsDispatch({ type: "REMOVE", payload: id })} className={styles.submit}>
        Done
      </button>
    </div>
  );
}

function DisplaySection() {
  const [settings, setSettings] = useAtom(settingsAtom);
  // Same lazy-initializer reasoning as AnalyticsSection: windows only
  // mount client-side, so localStorage is readable on first render.
  const [soundOn, setSoundOn] = useState(() => isStartupSoundOn());
  return (
    <fieldset>
      <legend>Display</legend>
      <div className={cx("field-row")}>
        <input
          id="crt-mode"
          type="checkbox"
          checked={!!settings.crt}
          onChange={(e) =>
            setSettings({ ...settings, crt: e.target.checked })
          }
        />
        <label htmlFor="crt-mode">CRT monitor mode</label>
      </div>
      <p className={styles.note} style={{ fontSize: 11 }}>
        Scanlines and a little glass curvature, like the monitor this
        site remembers running on.
      </p>
      <div className={cx("field-row")}>
        <input
          id="startup-sound"
          type="checkbox"
          checked={soundOn}
          onChange={(e) => {
            const on = e.target.checked;
            setSoundOn(on);
            setStartupSoundOn(on);
          }}
        />
        <label htmlFor="startup-sound">Play the startup sound</label>
      </div>
      <p className={styles.note} style={{ fontSize: 11 }}>
        Off by default. When on, the Win98 chime plays once per visit
        on your first click or keypress. Remembered on this device.
      </p>
    </fieldset>
  );
}

function AnalyticsSection() {
  // Lazy initializer instead of read-in-effect: the Settings program
  // only ever renders client-side (windows mount after hydration), so
  // localStorage is available on first render.
  const [optedOut, setOptedOut] = useState(() => isAnalyticsOptedOut());

  const toggle = () => {
    const next = !optedOut;
    setOptedOut(next);
    setAnalyticsOptedOut(next);
    try {
      void loadPosthog().then((ph) => {
        if (!ph) return;
        if (next) ph.opt_out_capturing();
        else ph.opt_in_capturing();
      });
    } catch {
      /* posthog may not be initialised yet — the flag still persists
       * and the next page load will respect it. */
    }
  };

  return (
    <fieldset>
      <legend>Analytics</legend>
      {/* Sibling pattern (input THEN label), not nested: 98.css draws
       * the checkbox via `input[type=checkbox] + label::before`, which
       * a nested input never matches — that's why this box used to
       * render invisibly. The mobile 40px tap target is handled by the
       * same sibling selector in globals.css. */}
      <div className={cx("field-row")}>
        <input
          id="analytics-opt-out"
          type="checkbox"
          checked={optedOut}
          onChange={toggle}
        />
        <label htmlFor="analytics-opt-out">
          Opt out of analytics (PostHog)
        </label>
      </div>
      <div className={cx("field-row")} style={{ marginTop: 4 }}>
        <p className={styles.note}>
          PostHog tracks anonymous events (reactions, errors, AI usage) so
          I can tell when something is broken. Plausible is cookieless and
          always on. See the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            privacy page
          </a>{" "}
          for the full list.
        </p>
      </div>
    </fieldset>
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
        <button
          onClick={handleClearDirectory}
          className={styles.button}
          disabled={!isRootDirectorySet}
        >
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
