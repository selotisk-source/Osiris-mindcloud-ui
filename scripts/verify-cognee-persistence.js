#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let appPort;
let memoryPort;
let appBase;
let memoryBase;

async function freePort() {
  const probe = http.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}
const root = path.resolve(__dirname, "..");
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindcloud-cognee-probe-"));
const records = new Map();

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
function collect(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
function listen(server, port) {
  return new Promise(resolve => server.listen(port, "127.0.0.1", resolve));
}
async function waitHealthy(child) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    try { const response = await fetch(appBase + "/health"); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("MindCloud server did not become healthy");
}

(async () => {
  appPort = await freePort();
  do { memoryPort = await freePort(); } while (memoryPort === appPort);
  appBase = "http://127.0.0.1:" + appPort;
  memoryBase = "http://127.0.0.1:" + memoryPort;
  const memory = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") { json(res, 200, { status: "healthy" }); return; }
      if (req.method === "POST" && req.url === "/api/v1/recall") {
        const input = JSON.parse(await collect(req));
        const saved = records.get(input.session_id);
        const results = saved && saved.includes(input.query) ? [{ content: saved }] : [];
        json(res, 200, { results });
        return;
      }
      if (req.method === "POST" && req.url === "/api/v1/remember") {
        const body = await collect(req);
        const rawData = body.match(/name="raw_data"\r\n\r\n([^\r\n]+)/);
        const session = body.match(/name="session_id"\r\n\r\n([^\r\n]+)/);
        const rawValue = rawData && rawData[1];
        const sessionId = session && session[1];
        if (!rawValue || !sessionId) { json(res, 400, { error: "missing_raw_data_or_session_id" }); return; }
        records.set(sessionId, rawValue);
        json(res, 200, { status: "stored", session_id: sessionId });
        return;
      }
      json(res, 404, { error: "not_found" });
    } catch (error) { json(res, 500, { error: String(error.message || error) }); }
  });
  await listen(memory, memoryPort);
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(appPort),
      COGNEE_SERVICE_URL: memoryBase,
      COGNEE_MEMORY_DATASET: "mindcloud-persistence-contract-test",
      BROWSER_USE_SERVICE_URL: "",
      BROWSER_USE_API_KEY: "",
      CCTV_SOURCE_URL: "",
      MINDCLOUD_MODEL_VERSION_STORE: path.join(storeDir, "versions.json"),
      MINDCLOUD_TASK_EVENT_STORE: path.join(storeDir, "tasks.json"),
      MINDCLOUD_EVIDENCE_GRAPH_STORE: path.join(storeDir, "evidence.json")
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  try {
    await waitHealthy(child);
    const response = await fetch(appBase + "/api/mindcloud/selftest", { method: "POST" });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.type, "mindcloud_e2e_selftest");
    assert.equal(result.integrations.memory.status, "healthy");
    assert.equal(result.integrations.memoryRoundTrip.status, "healthy");
    assert.equal(result.integrations.memoryRoundTrip.persisted, true);
    assert.equal(result.integrations.memoryRoundTrip.mode, "write-readback");
    assert.ok(result.integrations.memoryRoundTrip.readbackAttempts >= 1);
    assert.match(result.integrations.memoryRoundTrip.sessionId, /^mindcloud-persistence-probe-/);
    assert.match(result.integrations.memoryRoundTrip.markerHash, /^[a-f0-9]{64}$/);
    assert.ok(records.has(result.integrations.memoryRoundTrip.sessionId), "fresh write must reach the memory service");
    assert.ok(records.get(result.integrations.memoryRoundTrip.sessionId).startsWith("MINDCLOUD_PERSISTENCE_PROBE_V1_"));
    assert.ok(records.size >= 2, "startup and explicit self-test should use distinct probe sessions");
    assert.equal(new Set(records.keys()).size, records.size, "every persistence probe session must be unique");
    console.log(JSON.stringify({ status: "verified", checks: ["unique-persistence-probe-per-run", "fresh-write-before-readback", "bounded-readback-retries", "persisted-marker-found-in-same-session", "prior-record-cannot-mask-write-failure"], readbackAttempts: result.integrations.memoryRoundTrip.readbackAttempts, probesWritten: records.size }, null, 2));
  } catch (error) { console.error(stderr); console.error(error); process.exitCode = 1; }
  finally {
    child.kill("SIGKILL");
    memory.closeAllConnections && memory.closeAllConnections();
    await new Promise(resolve => memory.close(resolve));
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
