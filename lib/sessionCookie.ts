import type { cookies } from "next/headers";

// The access-code session. `lr_session` is httpOnly, so page script can
// never read it; Run and Help used to look for it in document.cookie
// anyway and asked for the code again on every open. `lr_has_session` is a
// readable marker that says only "a session exists" (it is not a
// credential: the server checks lr_session). Both are set and cleared
// together, here.

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export const SESSION_COOKIE = "lr_session";
export const SESSION_MARKER = "lr_has_session";

const base = {
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24, // 24 hours, matching the sessions row's lifetime
};

export function setSessionCookies(store: CookieStore, sessionId: string) {
  store.set(SESSION_COOKIE, sessionId, { ...base, httpOnly: true });
  store.set(SESSION_MARKER, "1", { ...base, httpOnly: false });
}

export function clearSessionCookies(store: CookieStore) {
  store.delete(SESSION_COOKIE);
  store.delete(SESSION_MARKER);
}
