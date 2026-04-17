// Resolve the true client IP behind our Cloudflare → Traefik → Next stack.
//
// Cloudflare sets "CF-Connecting-IP" to the original visitor's IP before
// proxying to origin. Traefik's default X-Forwarded-For handling only
// preserves the immediate upstream (Cloudflare edge) in our deployment,
// which makes XFF useless for distinguishing visitors. Prefer CF's
// header first, then fall back so this still works in local dev without
// Cloudflare.
export function getClientIP(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
