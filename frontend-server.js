"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8080);
// Security baseline: process-local throttling. For multi-replica production, use a
// shared store (e.g. Redis) and trusted proxy IP configuration before scaling out.
const crypto = require("node:crypto");
const RATE_WINDOW_MS = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60000));
const RATE_IP_MAX = Math.max(1, Number(process.env.RATE_LIMIT_IP_MAX || 120));
const RATE_USER_MAX = Math.max(1, Number(process.env.RATE_LIMIT_USER_MAX || 90));
const RATE_BUCKET_MAX = Math.max(1000, Number(process.env.RATE_LIMIT_BUCKET_MAX || 20000));
const rateBuckets = new Map();

function requestIdentity(req) {
  const ip = String(req.socket && req.socket.remoteAddress || "unknown").slice(0, 128);
  const auth = String(req.headers.authorization || "");
  // Hash the credential; never store or log the raw bearer token.
  const user = /^Bearer\\s+\\S+$/i.test(auth)
    ? crypto.createHash("sha256").update(auth).digest("hex").slice(0, 24)
    : null;
  return { ip, user };
}

function rateLimit(req, res, scope) {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.start >= RATE_WINDOW_MS) rateBuckets.delete(key);
  }
  // Bound memory under high-cardinality traffic.
  while (rateBuckets.size > RATE_BUCKET_MAX) {
    const oldestKey = rateBuckets.keys().next().value;
    if (oldestKey === undefined) break;
    rateBuckets.delete(oldestKey);
  }
  const { ip, user } = requestIdentity(req);
  const limits = [{ key: scope + ":ip:" + ip, max: RATE_IP_MAX }];
  if (user) limits.push({ key: scope + ":user:" + user, max: RATE_USER_MAX });
  for (const limit of limits) {
    let bucket = rateBuckets.get(limit.key);
    if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
      bucket = { start: now, count: 0 };
      rateBuckets.set(limit.key, bucket);
    }
    if (bucket.count >= limit.max) {
      const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - bucket.start)) / 1000));
      res.writeHead(429, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "retry-after": String(retryAfter),
        "x-ratelimit-limit": String(limit.max),
        "x-ratelimit-remaining": "0"
      });
      res.end(JSON.stringify({ error: "rate_limit_exceeded", retryAfterSeconds: retryAfter }));
      return false;
    }
    bucket.count += 1;
  }
  return true;
}

function setSecurityHeaders(res) {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("x-frame-options", "DENY");
}

const BACKEND_URL = process.env.MINDCLOUD_BACKEND_URL || "";
const ROOT = __dirname;
const STATIC_FILES = {
  "/": ["planetary.html", "text/html; charset=utf-8"],
  "/planetary": ["planetary.html", "text/html; charset=utf-8"],
  "/planetary/": ["planetary.html", "text/html; charset=utf-8"],
  "/workspace": ["index.html", "text/html; charset=utf-8"],
  "/workspace/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/trading": ["trading.html", "text/html; charset=utf-8"],
  "/trading/": ["trading.html", "text/html; charset=utf-8"],
  "/trading.html": ["trading.html", "text/html; charset=utf-8"],
  "/trading/tillvaxthuset": ["tillvaxthuset.html", "text/html; charset=utf-8"],
  "/trading/tillvaxthuset/": ["tillvaxthuset.html", "text/html; charset=utf-8"],
  "/bankkarta": ["bankkarta.html", "text/html; charset=utf-8"],
  "/bankkarta/": ["bankkarta.html", "text/html; charset=utf-8"],
  "/tillvaxthuset": ["tillvaxthuset.html", "text/html; charset=utf-8"],
  "/newsletter": ["newsletter.html", "text/html; charset=utf-8"],
  "/newsletter/": ["newsletter.html", "text/html; charset=utf-8"],
  "/newsletter.html": ["newsletter.html", "text/html; charset=utf-8"],
  "/sofia-research": ["sofia-research.html", "text/html; charset=utf-8"],
  "/sofia-research/": ["sofia-research.html", "text/html; charset=utf-8"],
  "/research/sofia": ["sofia-research.html", "text/html; charset=utf-8"],
  "/paraskevi": ["paraskevi.html", "text/html; charset=utf-8"],
  "/paraskevi/": ["paraskevi.html", "text/html; charset=utf-8"],
  "/paraskevi.html": ["paraskevi.html", "text/html; charset=utf-8"],
  "/articles/the-shrine-of-saint-paraskevi": ["paraskevi.html", "text/html; charset=utf-8"],
  "/assets/paraskevi-shrine.svg": ["assets/paraskevi-shrine.svg", "image/svg+xml; charset=utf-8"],
  "/osiris": ["osiris.html", "text/html; charset=utf-8"],
  "/osiris/": ["osiris.html", "text/html; charset=utf-8"],
  "/ipo": ["ipo.html", "text/html; charset=utf-8"],
  "/ipo/": ["ipo.html", "text/html; charset=utf-8"],
  "/ipo.html": ["ipo.html", "text/html; charset=utf-8"]
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
  res.end(body);
}

function probeBackendThroughProxy() {
  return new Promise((resolve) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port: PORT,
      path: "/api/mindcloud/status",
      method: "GET",
      headers: { accept: "application/json" }
    }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) response.destroy(new Error("probe_response_too_large"));
      });
      response.on("end", () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        const valid = response.statusCode >= 200 && response.statusCode < 300 &&
          parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
        resolve({
          ok: valid,
          status: response.statusCode || 0,
          error: valid ? null : "proxy_upstream_response_invalid"
        });
      });
      response.on("error", () => resolve({ ok: false, status: response.statusCode || 0, error: "proxy_probe_response_error" }));
    });
    request.setTimeout(7000, () => request.destroy(new Error("proxy_probe_timeout")));
    request.on("error", (error) => resolve({
      ok: false,
      status: 0,
      error: error.code || error.message || "proxy_probe_failed"
    }));
    request.end();
  });
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
  const requestTimeout = target.pathname === "/api/mindcloud/selftest" ? 180000 : 30000;
  upstream.setTimeout(requestTimeout, () => upstream.destroy(new Error("backend_timeout")));
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
  if (req.method === "GET" && url.pathname === "/ready") {
    probeBackendThroughProxy().then((probe) => {
      if (probe.ok) {
        send(res, 200, JSON.stringify({
          status: "ready",
          service: "mindcloud-frontend",
          backend: "reachable",
          proxy: "verified",
          upstreamStatus: probe.status
        }));
      } else {
        send(res, 503, JSON.stringify({
          status: "not_ready",
          service: "mindcloud-frontend",
          backend: "unreachable",
          proxy: "failed",
          error: probe.error || "backend_probe_failed",
          upstreamStatus: probe.status || null
        }));
      }
    }).catch(() => {
      send(res, 503, JSON.stringify({ status: "not_ready", service: "mindcloud-frontend", backend: "unreachable", proxy: "failed" }));
    });
    return;
  }
  if (url.pathname.startsWith("/newsletters/")) {
    const relative = url.pathname.slice("/newsletters/".length);
    const resolved = path.resolve(ROOT, "newsletters", relative);
    const archiveRoot = path.resolve(ROOT, "newsletters") + path.sep;
    if (!resolved.startsWith(archiveRoot) || relative.includes("..") || !/^[a-zA-Z0-9._/-]+$/.test(relative)) {
      send(res, 400, JSON.stringify({ error: "invalid_archive_path" })); return;
    }
    try {
      const body = fs.readFileSync(resolved);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch { send(res, 404, JSON.stringify({ error: "briefing_archive_file_not_found", path: relative })); }
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    if (!rateLimit(req, res, "api")) return;
    const urlLength = Buffer.byteLength(req.url || "", "utf8");
    if (urlLength > 4096) { send(res, 414, JSON.stringify({ error: "request_target_too_long" })); return; }
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
