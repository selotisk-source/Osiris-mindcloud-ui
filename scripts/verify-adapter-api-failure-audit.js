#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");

const appPort = 39150;
const providerPort = 39151;
const appBase = `http://127.0.0.1:${appPort}`;
const token = "mindcloud-adapter-failure-api-test-token";

function json(response) {
  return response.json().then(body => ({ status: response.status, body }));
}
async function waitHealthy(child) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(appBase + "/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("MindCloud API test server did not become healthy");
}

(async () => {
  let providerCalls = 0;
  const provider = http.createServer((req, res) => {
    providerCalls += 1;
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      assert.equal(req.method, "POST");
      assert.equal(req.url, "/execute");
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "provider_temporarily_unavailable" }));
    });
  });
  await new Promise(resolve => provider.listen(providerPort, "127.0.0.1", resolve));

  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(appPort),
      CCTV_SOURCE_URL: "",
      COGNEE_SERVICE_URL: "",
      ADAPTER_GRAFT_URL: `http://127.0.0.1:${providerPort}`,
      MINDCLOUD_TOOL_EXECUTION_TOKEN: token,
      MINDCLOUD_EVIDENCE_READ_TOKEN: "mindcloud-api-failure-evidence-read",
      MINDCLOUD_EVIDENCE_WRITE_TOKEN: "mindcloud-api-failure-evidence-write",
      MINDCLOUD_EVIDENCE_GRAPH_STORE: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });

  try {
    await waitHealthy(child);
    const before = await json(await fetch(appBase + "/api/adapters"));
    assert.equal(before.status, 200);
    const beforeAuditCount = before.body.auditCount;

    const unauthorized = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "graft", operation: "build", input: { target: "fixture" } })
    }));
    assert.equal(unauthorized.status, 401);

    const response = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + token
      },
      body: JSON.stringify({
        id: "graft",
        operation: "build",
        input: { target: "fixture" }
      })
    }));
    assert.equal(providerCalls, 1, "a non-read-only operation must not be retried");
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.status, 503);
    assert.equal(response.body.id, "graft");
    assert.equal(response.body.operation, "build");
    assert.equal(typeof response.body.requestId, "string");
    assert.ok(response.body.requestId.length > 0);

    const after = await json(await fetch(appBase + "/api/adapters"));
    assert.equal(after.status, 200);
    assert.equal(after.body.auditCount, beforeAuditCount + 1);
    const adapter = after.body.adapters.find(item => item.id === "graft");
    assert.ok(adapter);
    assert.equal(adapter.runtime.verification.status, "not-verified");

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "API-rejects-unauthenticated-execution",
        "HTTP-503-provider-failure-is-returned",
        "failure-is-recorded-in-runtime-audit",
        "request-result-has-request-id",
        "failed-execution-does-not-promote-adapter",
        "non-read-only-operation-is-not-retried"
      ],
      providerCalls,
      auditDelta: after.body.auditCount - beforeAuditCount,
      providerStatus: response.body.status
    }, null, 2));
  } catch (error) {
    console.error(stderr);
    throw error;
  } finally {
    child.kill("SIGKILL");
    provider.closeAllConnections?.();
    await new Promise(resolve => provider.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
