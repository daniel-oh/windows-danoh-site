import { Settings } from "@/state/settings";

// max_tokens is a ceiling on thinking + visible output together.
//
// "best" was 8192, sized for Sonnet 4.6 with thinking off. On Sonnet 5 the
// same app needs ~30% more tokens (new tokenizer) plus room for its plan, so
// 8192 would cut generated apps off mid-<script>. 20000 is a ceiling, not a
// spend: a typical app lands around 8-11k. Worst case is 20000 x $10/M =
// $0.20 per generation, and costGuard caps how many of those can happen.
//
// "cheap" goes 4096 -> 8192: Haiku was truncating larger apps too, and the
// worst case is 8192 x $5/M = $0.04.
export function getMaxTokens(settings: Settings) {
  if (settings.model === "best") {
    return 20000;
  }
  return 8192;
}
