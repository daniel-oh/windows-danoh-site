"use client";

type Shortcut = { keys: string[]; description: string };

const SHORTCUTS: { section: string; items: Shortcut[] }[] = [
  {
    section: "Windows",
    items: [
      { keys: ["Esc"], description: "Close the focused window" },
      { keys: ["Tab"], description: "Move focus between controls" },
      { keys: ["Shift", "Tab"], description: "Move focus backwards" },
      { keys: ["Enter"], description: "Activate focused button" },
      { keys: ["Space"], description: "Activate focused button or checkbox" },
    ],
  },
  {
    section: "Run",
    items: [
      { keys: ["Ctrl", "Enter"], description: "Submit the program prompt" },
      { keys: ["Cmd", "Enter"], description: "Submit (macOS)" },
    ],
  },
  {
    section: "Browsing",
    items: [
      {
        keys: ["Cmd", "+"],
        description: "Zoom in (works on mobile too; pinch to zoom)",
      },
    ],
  },
  {
    section: "Sharing",
    items: [
      {
        keys: ["?run=..."],
        description:
          "Append to the URL (e.g. ?run=a+snake+game) to auto-open Run with a prompt",
      },
    ],
  },
];

export function Shortcuts() {
  return (
    <div
      style={{
        padding: 12,
        overflow: "auto",
        flex: 1,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginTop: 0 }}>
        Keyboard shortcuts available throughout danoh.com.
      </p>
      {SHORTCUTS.map((group) => (
        <section key={group.section} style={{ marginTop: 12 }}>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: 4,
              borderBottom: "1px solid #808080",
              paddingBottom: 2,
            }}
          >
            {group.section}
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {group.items.map((item, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "baseline",
                  padding: "3px 0",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    gap: 2,
                    minWidth: 110,
                    flexShrink: 0,
                  }}
                >
                  {item.keys.map((k, j) => (
                    <kbd
                      key={j}
                      style={{
                        background: "#dfdfdf",
                        border: "1px solid #808080",
                        borderRadius: 2,
                        padding: "1px 5px",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
                <span>{item.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
