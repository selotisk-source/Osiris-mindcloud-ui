#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const dashboardHtml = fs.readFileSync("index.html", "utf8");
assert.doesNotMatch(dashboardHtml, /The camera proxy is not implemented yet/, "dashboard must not contradict the implemented server proxy");
assert.match(dashboardHtml, /proxyAuthStatus/, "dashboard must display proxy credential readiness");
assert.match(dashboardHtml, /frameStatus/, "dashboard must distinguish frame status");
assert.match(dashboardHtml, /evidenceStatus/, "dashboard must distinguish evidence verification");
const { spawn } = require("node:child_process");
const http = require("node:http");

const appPort = 39139;
const sourcePort = 39140;
const appBase = `http://127.0.0.1:${appPort}`;
const sourceBase = `http://127.0.0.1:${sourcePort}`;
const token = "mindcloud-cctv-proxy-test-token";
const playlist = "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:5.0,\nsegment.ts\n#EXT-X-ENDLIST\n";

function listen(server, port) {
  return new Promise(resolve => server.listen(port, "127.0.0.1", resolve));
}
async function waitHealthy(child) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(appBase + "/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("MindCloud server did not become healthy");
}
function encoded(url) {
  return Buffer.from(url, "utf8").toString("base64url");
}

(async () => {
  const source = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/live/index.m3u8") {
      res.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
      res.end(playlist);
      return;
    }
    if (req.method === "GET" && req.url === "/live/segment.ts") {
      res.writeHead(200, { "content-type": "video/mp2t" });
      res.end(Buffer.from("test-mpeg-ts-segment"));
      return;
    }
    if (req.method === "POST" && req.url === "/api/interpreter") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ elements: [] }));
      });
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  await listen(source, sourcePort);

  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(appPort),
      CCTV_SOURCE_URL: sourceBase + "/live/index.m3u8",
      CCTV_PROXY_TOKEN: token,
      COGNEE_SERVICE_URL: "",
      OVERPASS_API_URL: sourceBase + "/api/interpreter",
      MINDCLOUD_TOOL_EXECUTION_TOKEN: "adapter-route-test-token"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });

  try {
    await waitHealthy(child);

    const denied = await fetch(appBase + "/api/cctv/stream");
    assert.equal(denied.status, 401, "CCTV proxy must reject missing bearer token");

    const statusResponse = await fetch(appBase + "/api/cctv");
    const status = await statusResponse.json();
    assert.equal(status.proxyStatus, "implemented");
    assert.equal(status.streamStatus, "unverified", "configuration must not be mistaken for stream verification");
    assert.equal(status.proxyAuthStatus, "configured", "test proxy token must be reported as configured");
    assert.equal(status.frameStatus, "not_implemented", "configured source must not imply a verified frame");
    assert.equal(status.evidenceStatus, "not_verified", "configured source must not imply verified evidence");

    const manifestResponse = await fetch(appBase + "/api/cctv/stream", {
      headers: { authorization: "Bearer " + token }
    });
    assert.equal(manifestResponse.status, 200);
    assert.match(manifestResponse.headers.get("content-type"), /mpegurl/i);
    const manifest = await manifestResponse.text();
    assert.match(manifest, /^#EXTM3U/);
    const segmentMatch = manifest.match(/\/api\/cctv\/stream\?resource=([A-Za-z0-9_-]+)/);
    assert.ok(segmentMatch, "relative HLS segment should be rewritten through the authenticated proxy");

    const segmentResponse = await fetch(appBase + "/api/cctv/stream?resource=" + segmentMatch[1], {
      headers: { authorization: "Bearer " + token }
    });
    assert.equal(segmentResponse.status, 200);
    assert.equal(segmentResponse.headers.get("content-type"), "video/mp2t");
    assert.equal(Buffer.from(await segmentResponse.arrayBuffer()).toString(), "test-mpeg-ts-segment");

    const rejected = await fetch(appBase + "/api/cctv/stream?resource=" + encoded("https://example.com/private.m3u8"), {
      headers: { authorization: "Bearer " + token }
    });
    assert.equal(rejected.status, 400, "proxy must reject cross-origin resources");

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "cctv-proxy-requires-bearer-token",
        "configuration-does-not-claim-stream-verified",
        "hls-playlist-fetched-and-rewritten",
        "media-segment-fetched-through-proxy",
        "cross-origin-resource-rejected"
      ]
    }, null, 2));
  } catch (error) {
    console.error(stderr);
    console.error(error);
    process.exitCode = 1;
  } finally {
    child.kill("SIGKILL");
    source.closeAllConnections?.();
    await new Promise(resolve => source.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
