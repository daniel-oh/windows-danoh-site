import crypto from "crypto";

// Length-independent string compare for secrets. Both sides are padded to
// the longer length so timingSafeEqual (which throws on a length
// mismatch) always runs, and the length check happens after it rather
// than short-circuiting before.
export function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  bufA.write(a);
  bufB.write(b);
  return crypto.timingSafeEqual(bufA, bufB) && a.length === b.length;
}
