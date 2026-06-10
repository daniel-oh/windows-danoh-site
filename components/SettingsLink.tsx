import { openProgram } from "@/lib/programs";

export function SettingsLink() {
  return (
    <a
      onClick={(e) => {
        e.preventDefault();
        openProgram("settings");
      }}
    >
      Settings
    </a>
  );
}
