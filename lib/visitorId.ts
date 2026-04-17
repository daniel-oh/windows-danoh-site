// Shared anonymous visitor ID stored in localStorage. Reused by every
// no-signup interaction (reactions, hit counter, future guestbook, etc.).
const VISITOR_KEY = "danoh_visitor";

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
  return id;
}
