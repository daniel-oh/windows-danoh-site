"use client";

export default function ErrorPage({ reset }: { reset?: () => void }) {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#008080",
      }}
    >
      <div className="window" style={{ width: 320 }}>
        <div className="title-bar">
          <div className="title-bar-text">danoh.com - Error</div>
        </div>
        <div className="window-body">
          <p>Something went wrong.</p>
          <p style={{ fontSize: 11, color: "#666" }}>
            Try again, or refresh if the problem persists.
          </p>
          <div className="field-row" style={{ justifyContent: "flex-end" }}>
            <button onClick={() => (reset ? reset() : location.reload())}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
