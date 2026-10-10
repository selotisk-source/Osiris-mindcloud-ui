"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8080);
const BACKEND_URL = process.env.MINDCLOUD_BACKEND_URL || "";
const ROOT = __dirname;
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/trading.html": ["trading.html", "text/html; charset=utf-8"],
  "/newsletter.html": ["newsletter.html", "text/html; charset=utf-8"]
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(body);
}

function proxy(req, res) {
  if (!BACKEND_URL) {
    send(res, 503, JSON.stringify({ error: "mindcloud_backend_url_not_configured" }));
    return;
  }
  let target;
  try {
    target = new URL(req.url, BACKEND_URL);
    const base = new URL(BACKEND_URL);
    if (target.origin !== base.origin) throw new Error("origin_mismatch");
  } catch {
    send(res, 400, JSON.stringify({ error: "invalid_backend_target" }));
    return;
  }
  const transport = target.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: target.host, "x-forwarded-host": req.headers.host || "", "x-forwarded-proto": "https" };
  // Browser media elements cannot attach a bearer token. Add the server-held CCTV
  // credential only for the same-origin CCTV stream proxy, never to other APIs.
  if (target.pathname === "/api/cctv/stream" && process.env.CCTV_PROXY_TOKEN) {
    headers.authorization = "Bearer " + process.env.CCTV_PROXY_TOKEN;
  }
  delete headers.connection;
  delete headers["content-length"];
  const upstream = transport.request(target, { method: req.method, headers }, (upstreamRes) => {
    const outHeaders = { ...upstreamRes.headers, "x-content-type-options": "nosniff" };
    delete outHeaders.connection;
    delete outHeaders["transfer-encoding"];
    res.writeHead(upstreamRes.statusCode || 502, outHeaders);
    upstreamRes.pipe(res);
  });
  upstream.setTimeout(30000, () => upstream.destroy(new Error("backend_timeout")));
  upstream.on("error", (error) => {
    if (!res.headersSent) send(res, 502, JSON.stringify({ error: "mindcloud_backend_unavailable", detail: error.code || "upstream_error" }));
    else res.destroy(error);
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://frontend.local");
  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, JSON.stringify({ status: "healthy", service: "mindcloud-frontend", backendConfigured: Boolean(BACKEND_URL) }));
    return;
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/newsletters/")) {
    proxy(req, res);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, JSON.stringify({ error: "method_not_allowed" }));
    return;
  }
  const entry = STATIC_FILES[url.pathname];
  if (entry) {
    const file = path.join(ROOT, entry[0]);
    try {
      const body = fs.readFileSync(file);
      res.writeHead(200, { "content-type": entry[1], "cache-control": "no-cache", "x-content-type-options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      send(res, 500, JSON.stringify({ error: "frontend_asset_unavailable" }));
    }
    return;
  }
  send(res, 404, JSON.stringify({ error: "frontend_route_not_found", path: url.pathname }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("MindCloud frontend listening on port " + PORT);
});
