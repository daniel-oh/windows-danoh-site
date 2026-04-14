import { useAtom } from "jotai";
import {
  programAtomFamily,
  programVersionsAtomFamily,
  programsAtom,
} from "@/state/programs";
import styles from "./History.module.css";
import { useCreateContextMenu } from "@/state/contextMenu";

export function History({ id }: { id: string }) {
  const [program] = useAtom(programAtomFamily(id));
  const [versions] = useAtom(programVersionsAtomFamily(id));
  const [, setProgramsState] = useAtom(programsAtom);
  const createContextMenu = useCreateContextMenu();

  if (!program) return <div>Program not found</div>;

  const handleVersionChange = (version: number) => {
    setProgramsState({ type: "CHANGE_VERSION", payload: { id, version } });
  };

  const handleDeleteVersion = (version: number) => {
    setProgramsState({ type: "DELETE_VERSION", payload: { id, version } });
  };

  const handleContextMenu = (version: number) =>
    createContextMenu([
      {
        label: "Delete Version",
        onClick: () => handleDeleteVersion(version),
      },
    ]);

  return (
    <div className={styles.historyContainer}>
      <h4>Version History</h4>
      {versions.length === 0 ? (
        <p style={{ padding: 8, fontSize: 12, color: "#555" }}>
          No version history available yet. Versions are saved when you use Fix &amp; Iterate to update the app.
        </p>
      ) : (
        <div className={styles.versionList}>
          {versions.map((version) => (
            <div
              key={version}
              className={`${styles.versionItem} ${
                version === program.currentVersion ? styles.current : ""
              }`}
              onClick={() => handleVersionChange(version)}
              {...handleContextMenu(version)}
            >
              <span className={styles.versionDate}>
                {new Date(version).toLocaleString()}
              </span>
              {version === program.currentVersion && (
                <span className={styles.currentLabel}>(Current)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
