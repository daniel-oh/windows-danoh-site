import crypto from "crypto";

// SHA-256 of an invite code. Used everywhere invite codes are
// looked up / stored so plaintext never sits at rest in the
// database. The plaintext is generated in /api/invite POST, shown
// to the admin once in the response, and never re-displayed.
//
// Why SHA-256 (not bcrypt/argon2): invite codes are random 24+ hex
// strings, not low-entropy human passwords. A slow KDF buys nothing
// against brute-force when the search space is already ~96 bits.
// SHA-256 keeps the lookup fast enough for the per-request guard
// path without weakening the security posture.
export function hashInviteCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}
