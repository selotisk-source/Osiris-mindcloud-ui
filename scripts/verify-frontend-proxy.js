"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function unusedPort() {
  const server = http.createServer();
  const port = await listen(server);
  await close(server);
  return port;
}

async function waitForStartup(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("frontend_start_timeout: " + output)), 10000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/MindCloud frontend listening on port (\d+)/);
      if (match) {
        clearTimeout(timeout);
        child.stdout.removeListener("data", onData);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on("data", onData);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error("frontend_exited_before_start: " + code + " " + output));
    });
  });
}

async function main() {
  let upstreamMode = "ok";
  const upstream = http.createServer((req, res) => {
    if (req.url !== "/api/mindcloud/status") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    if (upstreamMode === "fail") {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_unavailable" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", tasks: [] }));
  });

  await listen(upstream);
  const frontendPort = await unusedPort();
  const child = spawn(process.execPath, [path.join(__dirname, "..", "frontend-server.js")], {
    env: {
      ...process.env,
      PORT: String(frontendPort),
      MINDCLOUD_BACKEND_URL: "http://127.0.0.1:" + upstream.address().port
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  try {
    await waitForStartup(child);

    const planetary = await fetch("http://127.0.0.1:" + frontendPort + "/");
    assert.equal(planetary.status, 200, "frontend root should serve the planetary view");
    assert.match(await planetary.text(), /MindCloud · Planetary View/, "frontend root should remain the planetary view");

    const workspace = await fetch("http://127.0.0.1:" + frontendPort + "/workspace");
    assert.equal(workspace.status, 200, "frontend should serve the two-station workspace route");
    const workspaceHtml = await workspace.text();
    assert.match(workspaceHtml, /data-module="Sensor Fabric"/, "workspace must expose the Sensor Fabric entry point");
    assert.match(workspaceHtml, /id="sensorFabricMap"/, "Sensor Fabric must include an interactive map container");
    assert.match(workspaceHtml, /sensorMapVarna/, "Sensor Fabric map must expose a usable map navigation control");
    assert.match(workspaceHtml, /openstreetmap\.org/, "interactive map must use an attributed public tile source");

    const osiris = await fetch("http://127.0.0.1:" + frontendPort + "/osiris");
    assert.equal(osiris.status, 200, "frontend should serve the OSIRIS console route");
    assert.match(osiris.headers.get("content-type") || "", /text\/html/i);
    assert.match(await osiris.text(), /Standalone Camera Console/);

    const osirisSlash = await fetch("http://127.0.0.1:" + frontendPort + "/osiris/");
    assert.equal(osirisSlash.status, 200, "frontend should serve the trailing-slash OSIRIS route");

    const directProxy = await fetch("http://127.0.0.1:" + frontendPort + "/api/mindcloud/status");
    assert.equal(directProxy.status, 200, "frontend proxy should relay a successful backend response");
    assert.deepEqual(await directProxy.json(), { status: "ok", tasks: [] });

    const ready = await fetch("http://127.0.0.1:" + frontendPort + "/ready");
    assert.equal(ready.status, 200, "readiness should pass only after a successful proxied API call");
    const readyBody = await ready.json();
    assert.equal(readyBody.status, "ready");
    assert.equal(readyBody.proxy, "verified");
    assert.equal(readyBody.upstreamStatus, 200);

    upstreamMode = "fail";
    const notReady = await fetch("http://127.0.0.1:" + frontendPort + "/ready");
    assert.equal(notReady.status, 503, "readiness must fail when the backend returns 503");
    const notReadyBody = await notReady.json();
    assert.equal(notReadyBody.status, "not_ready");
    assert.equal(notReadyBody.proxy, "failed");
    assert.equal(notReadyBody.upstreamStatus, 503);

    console.log("frontend-proxy-verification: passed OSIRIS route, direct proxy, healthy readiness, and upstream-failure rejection");
  } finally {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
    await close(upstream);
    if (stderr.trim()) process.stderr.write(stderr);
  }
}

main().catch((error) => {
  console.error("frontend-proxy-verification: failed", error);
  process.exitCode = 1;
});
