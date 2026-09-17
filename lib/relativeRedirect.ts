// Redirect with a path-only Location header.
//
// NextResponse.redirect needs an absolute URL, and the obvious source for
// one (request.url / request.nextUrl) is wrong in production: behind
// Traefik the standalone server sees itself as https://0.0.0.0:3000, so
// /auth/callback was sending visitors to https://0.0.0.0:3000/error.
// A relative Location is valid HTTP (RFC 9110 §10.2.2), the browser
// resolves it against the URL it actually requested, and it cannot leave
// the site no matter what the path contains. Callers still validate the
// path (see safeNext) so "//host" never gets here.
export function relativeRedirect(pathAndQuery: string, status = 307): Response {
  return new Response(null, {
    status,
    headers: { Location: pathAndQuery },
  });
}
