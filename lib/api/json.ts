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

// Largest body the AI routes accept. A generated app's source (at most
// ~80 KB: 20k output tokens) plus a long Help conversation fits with room
// to spare; the only thing over it is someone buying a million input
// tokens on the server's key, which Next's own 10 MB limit allowed.
export const AI_BODY_LIMIT = 256 * 1024;

/** 413 when the body is over `limit` bytes. Counts what actually arrives
 * (a chunked body has no Content-Length), reading a clone so the route and
 * the gates can still read the original. */
export async function rejectOversized(
  req: Request,
  limit = AI_BODY_LIMIT
): Promise<Response | null> {
  const tooLarge = () =>
    Response.json({ error: "Request too large" }, { status: 413 });
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return tooLarge();
  const stream = req.clone().body;
  if (!stream) return null;
  // Read to the end rather than stopping at the limit. The clone is one
  // branch of a tee: cancelling it leaves nothing pulling the request, the
  // upload stalls, and the 413 never reaches the client. Next already caps
  // a body at 10 MB, so draining is bounded.
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
  }
  return total > limit ? tooLarge() : null;
}
