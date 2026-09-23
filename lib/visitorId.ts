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

// One id per page load when storage is blocked, so a visitor with
// storage off still gets a consistent id for this visit.
let memoryId: string | null = null;

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id: string | null;
  try {
    id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = newId();
      window.localStorage.setItem(VISITOR_KEY, id);
    }
  } catch {
    // Safari "Block all cookies" throws on localStorage itself.
    memoryId ??= newId();
    id = memoryId;
  }
  writeCookie(id);
  return id;
}
