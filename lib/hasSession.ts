/** Whether this browser holds an access-code session. Reads the readable
 * marker set beside the httpOnly session cookie (lib/sessionCookie.ts);
 * the server still decides whether the session is valid. */
export function hasSession(): boolean {
  return typeof document !== "undefined" && /(?:^|;\s*)lr_has_session=1/.test(document.cookie);
}
