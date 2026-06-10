"use client";

import { useState } from "react";
import { useAtom } from "jotai";
import {
  settingsAtom,
  isApiKeyRemembered,
  setApiKeyRemembered,
} from "@/state/settings";
import { testAnthropicKey } from "@/lib/testAnthropicKey";

// The bring-your-own-key path, inline where the decision happens (the
// Run gate) instead of a footnote pointing at a different window. One
// button: validate against Anthropic, then save. The privacy note is
// load-bearing — someone pasting a paid API key into a stranger's
// website deserves to be told exactly where it goes, at the moment
// they're deciding.
export function ByokPrompt({ onSuccess }: { onSuccess: () => void }) {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [key, setKey] = useState("");
  const [remember, setRemember] = useState(() => isApiKeyRemembered());
  const [status, setStatus] = useState<"idle" | "testing" | "invalid">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed || status === "testing") return;
    setStatus("testing");
    if ((await testAnthropicKey(trimmed)) !== "valid") {
      setStatus("invalid");
      return;
    }
    // Order matters: the flag must be set before the settings write so
    // the storage layer mirrors the key in the same pass.
    setApiKeyRemembered(remember, trimmed);
    setSettings({ ...settings, apiKey: trimmed });
    setStatus("idle");
    onSuccess();
  };

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <div style={{ display: "flex", gap: 5 }}>
        <input
          type="password"
          aria-label="Anthropic API key"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            if (status === "invalid") setStatus("idle");
          }}
          autoComplete="off"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={!key.trim() || status === "testing"}>
          {status === "testing" ? "Checking…" : "Use key"}
        </button>
      </div>
      {status === "invalid" && (
        <div role="alert" style={{ color: "#800000", fontSize: 11 }}>
          That key didn&apos;t work. Check it and try again.
        </div>
      )}
      <div className="field-row">
        <input
          id="byok-remember"
          type="checkbox"
          checked={remember}
          onChange={(e) => {
            setRemember(e.target.checked);
            setApiKeyRemembered(e.target.checked, settings.apiKey);
          }}
        />
        <label htmlFor="byok-remember" style={{ fontSize: 11 }}>
          Remember on this device (skip on shared computers)
        </label>
      </div>
      <p style={{ fontSize: 11, color: "#444", margin: 0, lineHeight: 1.5 }}>
        Stored only in your browser. Sent only with your generation
        requests, never stored on our server. This check goes straight
        from your browser to Anthropic.{" "}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#000080" }}
        >
          Get a key
        </a>{" "}
        ·{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#000080" }}
        >
          Privacy
        </a>
      </p>
    </form>
  );
}
