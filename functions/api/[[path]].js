export async function onRequest(context) {
  const base = String(context.env.MINDCLOUD_BACKEND_URL || "").trim();
  if (!base) {
    return Response.json(
      { error: "mindcloud_backend_url_not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  let upstream;
  try {
    const incoming = new URL(context.request.url);
    const backend = new URL(base);
    if (backend.protocol !== "https:" && backend.protocol !== "http:") {
      throw new Error("unsupported_backend_protocol");
    }
    upstream = new URL(incoming.pathname + incoming.search, backend);
    if (upstream.origin !== backend.origin) throw new Error("backend_origin_mismatch");
  } catch {
    return Response.json(
      { error: "invalid_backend_url" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const headers = new Headers(context.request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.set("x-forwarded-host", new URL(context.request.url).host);
  headers.set("x-forwarded-proto", "https");

  const request = new Request(upstream, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "manual"
  });

  try {
    const response = await fetch(request);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("x-content-type-options", "nosniff");
    responseHeaders.delete("connection");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch {
    return Response.json(
      { error: "mindcloud_backend_unavailable" },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }
}
