// Shared anonymous visitor ID stored in localStorage. Reused by every
// no-signup interaction (reactions, hit counter, guestbook, contact,
// cost guard). The same value is mirrored into a cookie so server-side
// rate limiters (costGuard) can key on a stable identity even for
// endpoints that don't already receive visitorId in the body.
const VISITOR_KEY = "danoh_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 days — browsers cap here

function writeCookie(id: string) {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie =
    `${VISITOR_KEY}=${encodeURIComponent(id)}; ` +
    `Max-Age=${COOKIE_MAX_AGE}; ` +
    `Path=/; SameSite=Lax` +
    (secure ? "; Secure" : "");
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  writeCookie(id);
  return id;
}
