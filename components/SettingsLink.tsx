import { createWindow } from "@/lib/createWindow";
import { SETTINGS_WIDTH, SETTINGS_HEIGHT } from "./programs/Settings";

export function SettingsLink() {
  return (
    <a
      onClick={(e) => {
        e.preventDefault();
        createWindow({
          title: "Settings",
          program: { type: "settings" },
          size: { width: SETTINGS_WIDTH, height: SETTINGS_HEIGHT },
        });
      }}
    >
      Settings
    </a>
  );
}
