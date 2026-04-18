import { alert } from "./alert";

// Standard retro alert for rate-limit (429) and daily-cap (503) rejections
// from any AI endpoint. Centralised here so every POST caller gets the
// same framing instead of each component inventing its own error toast.
// alertId is keyed on status so one burst of failed requests can't stack
// duplicate alerts on top of each other.
export async function showRateLimited(
  res: Response,
  status: 429 | 503
): Promise<void> {
  let serverMessage =
    status === 503
      ? "The site hit its daily generation budget. Come back tomorrow."
      : "Generation limit reached. Try again soon.";
  try {
    const data = await res.clone().json();
    if (typeof data?.error === "string") serverMessage = data.error;
  } catch {
    /* non-JSON body — fall back to the generic message */
  }

  alert({
    alertId: `RATE_LIMIT_${status}`,
    icon: "x",
    message: (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ margin: 0 }}>{serverMessage}</p>
        <p style={{ margin: 0, fontSize: 11, color: "#555" }}>
          Want to keep running now? Drop your own Anthropic API key in
          Settings and we&apos;ll step out of the way.
        </p>
      </div>
    ),
  });
}
