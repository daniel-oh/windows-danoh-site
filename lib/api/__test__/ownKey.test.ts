/**
 * @jest-environment node
 */
// node, not jsdom: these exercise the fetch-API Request the route
// handlers receive, which jsdom does not provide.
import { hasOwnAnthropicKey } from "@/lib/api/hasOwnAnthropicKey";
import { getSettingsFromJSON } from "@/lib/getSettingsFromRequest";
import { requireJson } from "@/lib/api/json";

const REAL_SHAPED = "sk-ant-" + "a".repeat(90);

function post(url: string, body: unknown, contentType = "application/json") {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("own-key detection agrees with what the routes actually use", () => {
  // Regression: a well-formed fake key in ?settings= used to skip
  // checkAccess + the costGuard budget caps while the route, reading the
  // body only, fell back to the server's ANTHROPIC_API_KEY.
  it("ignores a key smuggled in the query string", async () => {
    const qs = encodeURIComponent(JSON.stringify({ apiKey: REAL_SHAPED }));
    const req = post(`https://danoh.com/api/program?settings=${qs}`, {
      description: "x",
      settings: { model: "best" },
    });
    expect(await hasOwnAnthropicKey(req)).toBe(false);
  });

  it("accepts a well-formed key in the body and leaves the body readable", async () => {
    const req = post("https://danoh.com/api/chat", {
      settings: { apiKey: REAL_SHAPED },
    });
    expect(await hasOwnAnthropicKey(req)).toBe(true);
    expect((await req.json()).settings.apiKey).toBe(REAL_SHAPED);
  });

  it.each([
    ["too short", "sk-ant-short"],
    ["wrong prefix", "sk-live-" + "a".repeat(90)],
    ["non-string", 12345],
    ["empty", ""],
  ])("rejects %s keys, and the route drops them too", async (_label, apiKey) => {
    const body = { settings: { apiKey } };
    expect(await hasOwnAnthropicKey(post("https://danoh.com/api/chat", body))).toBe(false);
    expect((await getSettingsFromJSON(body)).apiKey).toBeNull();
  });

  it("the route keeps exactly the keys the gate accepts", async () => {
    const settings = await getSettingsFromJSON({ settings: { apiKey: REAL_SHAPED, model: "cheap" } });
    expect(settings).toEqual({ apiKey: REAL_SHAPED, model: "cheap" });
  });

  it.each([null, undefined, "str", 7, [], { settings: "nope" }])(
    "tolerates a %p body without throwing",
    async (body) => {
      expect(await getSettingsFromJSON(body)).toEqual({ apiKey: null, model: "best" });
    }
  );

  it("treats GETs and unparseable bodies as no key", async () => {
    expect(await hasOwnAnthropicKey(new Request("https://danoh.com/api/chat"))).toBe(false);
    expect(await hasOwnAnthropicKey(post("https://danoh.com/api/chat", "{not json"))).toBe(false);
  });
});

describe("requireJson", () => {
  // The three content types an HTML form can send without a preflight.
  it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"])(
    "rejects form-settable %s",
    async (ct) => {
      const res = requireJson(post("https://danoh.com/api/program", "{}", ct));
      expect(res?.status).toBe(415);
    }
  );

  it("passes application/json with a charset", () => {
    expect(requireJson(post("https://danoh.com/api/program", "{}", "application/json; charset=utf-8"))).toBeNull();
  });
});
