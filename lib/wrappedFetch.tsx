import { showRateLimited } from "./showRateLimited";
import { showUpsell } from "./showUpsell";

// Centralised client for the AI endpoints. Gives every caller
// consistent UX on the three rejection shapes they all share:
//   402 — visitor is out of purchased tokens (showUpsell)
//   429 — per-IP / per-visitor cap hit (retro alert)
//   503 — global daily cap hit (retro alert)
// Callers still get the raw Response back so they can short-circuit
// their own rendering (e.g., not kick off a stream).
export async function wrappedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    const response = await fetch(input, init);
    if (!response.ok) {
      if (response.status === 402) {
        showUpsell();
      } else if (response.status === 429 || response.status === 503) {
        void showRateLimited(response, response.status);
      }
    }
    return response;
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
}

export default wrappedFetch;
