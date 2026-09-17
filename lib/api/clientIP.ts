import { BlockList, isIP } from "node:net";

// Resolve the true client IP behind Cloudflare -> Traefik -> Next.
//
// The catch: the origin is reachable directly, not only through
// Cloudflare. Anyone who connects to it straight can send any
// CF-Connecting-IP they like, and Traefik passes that header through
// untouched. This function used to trust it unconditionally, so every
// per-IP limit on the site (cost guard, guestbook, contact, the invite and
// access-code lockouts) could be reset at will with one forged header.
//
// What can be trusted is the TCP peer, and Traefik tells us who that was:
// the RIGHT-MOST X-Forwarded-For entry is always the address that
// connected to Traefik. Checked against traefik:v3 with our
// forwardedHeaders.trustedIPs setup:
//   peer is Cloudflare  ->  XFF: "<visitor>, <cloudflare edge>"
//   peer is anyone else ->  XFF: "<that peer>"   (inbound XFF discarded)
//
// So: CF-Connecting-IP counts only when the peer is a Cloudflare edge.
// Otherwise the peer itself is the client, whatever headers it sent.
//
// NOT right-most XFF on its own: behind Cloudflare that is the edge
// address, and every visitor would share a handful of buckets.
// NOT X-Real-Ip: for a trusted peer Traefik forwards whatever the client
// supplied, so it is forgeable through Cloudflare too.

// https://www.cloudflare.com/ips/ (same list as the Traefik stack's
// trustedIPs). Changes rarely; when it does, update both. A stale list
// fails safe: an unknown edge is treated as a direct client, so its
// visitors share a bucket until the list is refreshed, never the reverse.
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const cloudflare = new BlockList();
for (const range of CLOUDFLARE_RANGES) {
  const [addr, prefix] = range.split("/");
  cloudflare.addSubnet(addr, Number(prefix), addr.includes(":") ? "ipv6" : "ipv4");
}

// "::ffff:1.2.3.4" is how a dual-stack socket reports an IPv4 peer.
function normalize(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return mapped ? mapped[1] : ip;
}

function isCloudflare(ip: string): boolean {
  const family = isIP(ip);
  if (!family) return false;
  return cloudflare.check(ip, family === 6 ? "ipv6" : "ipv4");
}

export function getClientIP(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const hops = fwd ? fwd.split(",").map((h) => normalize(h.trim())).filter(Boolean) : [];
  const peer = hops[hops.length - 1];
  if (!peer || !isIP(peer)) return "unknown";

  if (isCloudflare(peer)) {
    const cf = normalize((req.headers.get("cf-connecting-ip") ?? "").trim());
    // Validated: it becomes a rate-limit key and an analytics property.
    if (isIP(cf)) return cf;
  }
  return peer;
}
