// "Phone-ish" detection for window sizing and interaction defaults.
//
// Media query, not raw innerWidth/innerHeight: the old check treated
// any viewport under 768px tall as mobile, which misfired on common
// 1366x768 laptops (forced-maximized windows, single-click icons).
// max-width matches the CSS breakpoint in globals.css; pointer:coarse
// catches landscape phones and tablets, whose widths exceed it.
export const MOBILE_QUERY = "(max-width: 768px), (pointer: coarse)";

export function isMobile() {
  return (
    typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
}
