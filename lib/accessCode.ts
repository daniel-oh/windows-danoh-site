import crypto from "crypto";

export function getCodeHash(): string {
  const code = process.env.ACCESS_CODE || "";
  return crypto.createHash("sha256").update(code).digest("hex").slice(0, 16);
}
