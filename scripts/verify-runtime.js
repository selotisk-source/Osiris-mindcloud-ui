#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const port = 39127;
const base = `http://127.0.0.1:${port}`;
const root = path.resolve(__dirname, "..");

function get(url) {
  return fetch(base + url, { headers: { accept: "application/json" } }).then(async (res) => ({
    status: res.status,
    body: await res.json()
  }));
}

async function waitForHealth(child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const result = await get("/health");
      if (result.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server did not become healthy");
}

(async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), CCTV_SOURCE_URL: "" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHealth(child);

    const health = await get("/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");

    const router = await get("/api/router?kind=general");
    assert.equal(router.status, 200);
    assert.ok(router.body.network);
    assert.ok(router.body.route);

    const capabilities = await get("/api/capabilities");
    assert.equal(capabilities.status, 200);
    assert.equal(capabilities.body.type, "mindcloud_capability_registry");
    assert.ok(Array.isArray(capabilities.body.capabilities));

    const liveness = await get("/api/liveness/route");
    assert.equal(liveness.status, 200);
    assert.equal(liveness.body.humanApprovalRequired, true);

    const cctv = await get("/api/cctv");
    assert.equal(cctv.status, 200);
    assert.equal(cctv.body.status, "not_configured");
    assert.equal(cctv.body.proxyStatus, "not_implemented");
    assert.equal(cctv.body.access, "unconfigured");

    const memory = await get("/api/memory/health");
    assert.equal(memory.status, 200);
    assert.equal(memory.body.status, "not_configured");

    const runtime = await get("/api/runtime/status");
    assert.equal(runtime.status, 200);
    assert.equal(runtime.body.type, "mindcloud_runtime_status");
    assert.equal(runtime.body.health, "ok");
    assert.ok(runtime.body.cctv);
    assert.ok(runtime.body.memory);

    const sidepanel = fs.readFileSync(path.join(root, "extension", "sidepanel.html"), "utf8");
    const manifest = fs.readFileSync(path.join(root, "extension", "manifest.json"), "utf8");
    assert.match(sidepanel, /Station A · Brave \/ Runtime/);
    assert.match(sidepanel, /Station B · Source \/ Evidence/);
    assert.match(sidepanel, /\/api\/cctv/);
    assert.match(manifest, /"side_panel"/);
    const manifestData = JSON.parse(manifest);
    assert.deepEqual(
      manifestData.host_permissions,
      ["https://osiris-mindcloud.up.railway.app/*"],
      "Brave host permissions must be restricted to the exact production host"
    );

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "health",
        "router",
        "capabilities",
        "liveness-approval-gate",
        "cctv-safe-unconfigured-state",
        "memory-health",
        "runtime-status",
        "two-station-sidepanel",
        "brave-host-permission"
      ]
    }, null, 2));
  } catch (error) {
    console.error(stderr);
    console.error(error);
    process.exitCode = 1;
  } finally {
    child.kill("SIGTERM");
  }
})();
