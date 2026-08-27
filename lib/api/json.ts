// Shared request-body helpers for the JSON API routes.
//
// requireJson: the guestbook / contact / reactions / visits endpoints
// need no cookie, so a third-party page (or a generated program inside
// its opaque-origin iframe) could POST to them as a "simple" cross-site
// request and have the submission attributed to the visitor's IP.
// Insisting on application/json makes the browser send a CORS preflight
// first, which this server never approves. Our own callers all set the
// header already.
//
// parseJson: a malformed body used to surface as an unhandled 500 in
// half the routes. Same 400 shape everywhere now.

export function requireJson(req: Request): Response | null {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return Response.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }
  return null;
}

export type ParsedJson =
  | { ok: true; body: unknown }
  | { ok: false; response: Response };

export async function parseJson(req: Request): Promise<ParsedJson> {
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
}
