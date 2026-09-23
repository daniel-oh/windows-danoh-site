/**
 * @jest-environment node
 */
import { getClientIP, rateLimitKey } from "@/lib/api/clientIP";

const req = (headers: Record<string, string>) =>
  new Request("https://danoh.com/api/visits", { headers });

const CF_V4 = "172.68.10.20"; // inside 172.64.0.0/13
const CF_V6 = "2606:4700:10::ac43:1"; // inside 2606:4700::/32
const VISITOR = "203.0.113.50";
const ATTACKER = "198.51.100.77";

describe("getClientIP", () => {
  it("through Cloudflare (v4 edge): the visitor from CF-Connecting-IP", () => {
    expect(
      getClientIP(req({ "x-forwarded-for": `${VISITOR}, ${CF_V4}`, "cf-connecting-ip": VISITOR }))
    ).toBe(VISITOR);
  });

  it("through Cloudflare (v6 edge)", () => {
    expect(
      getClientIP(req({ "x-forwarded-for": `${VISITOR}, ${CF_V6}`, "cf-connecting-ip": VISITOR }))
    ).toBe(VISITOR);
  });

  it("through Cloudflare, edge reported as IPv4-mapped IPv6", () => {
    expect(
      getClientIP(req({ "x-forwarded-for": `${VISITOR}, ::ffff:${CF_V4}`, "cf-connecting-ip": VISITOR }))
    ).toBe(VISITOR);
  });

  // The hole this closes. Traefik rewrites XFF to the real peer for an
  // untrusted connection but forwards CF-Connecting-IP as sent.
  it("direct to origin with a forged CF-Connecting-IP: the real peer wins", () => {
    expect(
      getClientIP(req({ "x-forwarded-for": ATTACKER, "cf-connecting-ip": "1.2.3.4" }))
    ).toBe(ATTACKER);
  });

  it("a forged header cannot mint fresh buckets: same peer, same key", () => {
    const keys = ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((forged) =>
      getClientIP(req({ "x-forwarded-for": ATTACKER, "cf-connecting-ip": forged }))
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("never reads X-Real-Ip (client-controlled when the peer is trusted)", () => {
    expect(
      getClientIP(req({ "x-forwarded-for": `${VISITOR}, ${CF_V4}`, "cf-connecting-ip": VISITOR, "x-real-ip": "6.6.6.6" }))
    ).toBe(VISITOR);
    expect(getClientIP(req({ "x-real-ip": "6.6.6.6" }))).toBe("unknown");
  });

  it("Cloudflare peer but a garbage CF-Connecting-IP: falls back to the edge, not the garbage", () => {
    expect(
      getClientIP(req({ "x-forwarded-for": `${VISITOR}, ${CF_V4}`, "cf-connecting-ip": "<script>" }))
    ).toBe(CF_V4);
  });

  it("an address that merely looks Cloudflare-ish is not trusted", () => {
    // 172.72.0.0 is just outside 172.64.0.0/13
    expect(
      getClientIP(req({ "x-forwarded-for": "172.72.0.1", "cf-connecting-ip": "1.2.3.4" }))
    ).toBe("172.72.0.1");
  });

  it("local dev / private peer: the peer", () => {
    expect(getClientIP(req({ "x-forwarded-for": "::1" }))).toBe("::1");
    expect(getClientIP(req({ "x-forwarded-for": "172.18.0.1", "cf-connecting-ip": "1.2.3.4" }))).toBe("172.18.0.1");
  });

  it("no usable header: 'unknown'", () => {
    expect(getClientIP(req({}))).toBe("unknown");
    expect(getClientIP(req({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
  });
});

describe("rateLimitKey", () => {
  it("keeps IPv4 as the address", () => {
    expect(rateLimitKey("203.0.113.9")).toBe("203.0.113.9");
  });

  it("groups an IPv6 /64, however the address is written", () => {
    const a = rateLimitKey("2001:db8:abcd:12:1:2:3:4");
    expect(a).toBe("2001:db8:abcd:12::/64");
    expect(rateLimitKey("2001:0DB8:ABCD:0012:ffff::1")).toBe(a);
    expect(rateLimitKey("2001:db8:abcd:12::")).toBe(a);
  });

  it("keeps different /64s apart", () => {
    expect(rateLimitKey("2001:db8:abcd:13::1")).not.toBe(rateLimitKey("2001:db8:abcd:12::1"));
  });

  it("expands a short prefix", () => {
    expect(rateLimitKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });

  it("passes non-addresses through", () => {
    expect(rateLimitKey("unknown")).toBe("unknown");
  });
});
