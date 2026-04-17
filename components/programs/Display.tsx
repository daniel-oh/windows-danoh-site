"use client";

import { useAtom } from "jotai";
import { DEFAULT_THEME, THEME_KEY, Theme, registryAtom } from "@/state/registry";

export function Display() {
  const [registry, setRegistry] = useAtom(registryAtom);
  const current: Theme =
    registry[THEME_KEY] === "dark" ? "dark" : DEFAULT_THEME;

  const setTheme = (next: Theme) => {
    setRegistry({ ...registry, [THEME_KEY]: next });
  };

  return (
    <div style={{ padding: 12, overflow: "auto", flex: 1, fontSize: 13 }}>
      <fieldset style={{ marginBottom: 12 }}>
        <legend>Theme</legend>
        <p style={{ fontSize: 11, color: "#555", margin: "4px 0 8px 0" }}>
          Light keeps the classic look. Dark darkens window bodies and the
          desktop while leaving the title-bar chrome intact.
        </p>
        <div
          className="field-row"
          style={{ display: "flex", gap: 16, flexWrap: "wrap" }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={current === "light"}
              onChange={() => setTheme("light")}
            />
            Light (classic)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={current === "dark"}
              onChange={() => setTheme("dark")}
            />
            Dark
          </label>
        </div>
      </fieldset>
      <p style={{ fontSize: 11, color: "#555" }}>
        Generated programs can read the current theme from{" "}
        <code>registry.get(&quot;public_theme&quot;)</code> and style
        themselves accordingly.
      </p>
    </div>
  );
}
