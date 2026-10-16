#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindcloud-adapter-e2e-"));
const storePath = path.join(storeDir, "evidence-graph.json");
const token = "mindcloud-adapter-e2e-execution-token";
const readToken = "mindcloud-adapter-e2e-read-token";
const ports = { provider: 39241, backend: 39242, frontend: 39243 };
const base = {
  provider: `http://127.0.0.1:${ports.provider}`,
  backend: `http://127.0.0.1:${ports.backend}`,
  frontend: `http://127.0.0.1:${ports.frontend}`
};
const children = [];

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}
function stop(child) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  child.kill("SIGTERM");
  return new Promise(resolve => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolve(); }, 1500);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
  });
}
async function waitHealthy(url, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Process exited before healthy: ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Service did not become healthy: ${url}`);
}
function start(script, env) {
  const child = spawn(process.execPath, [script], { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });
  child.stderrText = () => stderr;
  children.push(child);
  return child;
}
async function json(response) {
  return { status: response.status, body: await response.json() };
}
function backendEnv() {
  return {
    NODE_ENV: "test",
    PORT: String(ports.backend),
    CCTV_SOURCE_URL: "",
    COGNEE_SERVICE_URL: "",
    BROWSER_USE_SERVICE_URL: "",
    BROWSER_USE_API_KEY: "",
    OVERPASS_API_URL: base.provider + "/api/interpreter",
    MINDCLOUD_TOOL_EXECUTION_TOKEN: token,
    MINDCLOUD_EVIDENCE_READ_TOKEN: readToken,
    MINDCLOUD_EVIDENCE_WRITE_TOKEN: "mindcloud-adapter-e2e-write-token",
    MINDCLOUD_EVIDENCE_GRAPH_STORE: storePath
  };
}

(async () => {
  const provider = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/api/interpreter") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      assert.match(body, /data=/);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ elements: [
        { type: "node", id: 17, lat: 43.2, lon: 27.9, tags: { name: "Persistence E2E point" } }
      ] }));
    });
  });
  await listen(provider, ports.provider);
  let frontend;
  let backend;
  try {
    backend = start("server.js", backendEnv());
    await waitHealthy(base.backend + "/health", backend);

    const execution = await json(await fetch(base.backend + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ id: "overpass-turbo", operation: "export_geojson", input: { query: "[out:json];out;" } })
    }));
    assert.equal(execution.status, 200, JSON.stringify(execution.body));
    assert.equal(execution.body.ok, true);
    assert.equal(execution.body.result.features.length, 1);
    assert.ok(execution.body.evidenceGraph?.nodeId, "adapter execution must return an evidence node ID");
    assert.ok(fs.existsSync(storePath), "adapter evidence must be persisted to the configured store");
    const persisted = JSON.parse(fs.readFileSync(storePath, "utf8"));
    assert.ok(persisted.nodes.some(node => node.id === execution.body.evidenceGraph.nodeId),
      "the persisted evidence store must contain the adapter observation");

    await stop(backend);
    backend = null;

    backend = start("server.js", backendEnv());
    await waitHealthy(base.backend + "/health", backend);
    frontend = start("frontend-server.js", {
      NODE_ENV: "test",
      PORT: String(ports.frontend),
      MINDCLOUD_BACKEND_URL: base.backend
    });
    await waitHealthy(base.frontend + "/health", frontend);

    const readback = await json(await fetch(base.frontend + "/api/mindcloud/evidence-graph", {
      headers: { authorization: "Bearer " + readToken }
    }));
    assert.equal(readback.status, 200, JSON.stringify(readback.body));
    const node = readback.body.nodes.find(item => item.id === execution.body.evidenceGraph.nodeId);
    assert.ok(node, "frontend proxy must expose the persisted observation after backend restart");
    assert.equal(node.type, "tool-observation");
    assert.equal(node.content.toolId, "overpass-turbo");
    assert.equal(node.content.operation, "export_geojson");
    assert.equal(node.content.validationStatus, "unvalidated");

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "authorized-real-http-adapter-execution",
        "provider-response-transformed",
        "evidence-node-persisted-to-disk",
        "backend-restart-reloads-evidence",
        "frontend-proxy-reads-persisted-evidence",
        "evidence-node-correlates-to-original-execution"
      ],
      evidenceNodeId: execution.body.evidenceGraph.nodeId
    }, null, 2));
  } catch (error) {
    for (const child of children) {
      if (child.exitCode === null) process.stderr.write(child.stderrText() + "\n");
    }
    console.error(error);
    process.exitCode = 1;
  } finally {
    await Promise.all(children.map(stop));
    provider.closeAllConnections?.();
    await new Promise(resolve => provider.close(resolve));
    fs.rmSync(storeDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
