#!/usr/bin/env node
const assert = require("node:assert/strict");
const http = require("node:http");
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");

(async () => {
  const port = 39149;
  const endpoint = `http://127.0.0.1:${port}`;
  const envNames = ["ADAPTER_TEST_ADAPTER_URL", "ADAPTER_TEST_ADAPTER_TWO_URL"];
  const previousEndpoints = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  let providerCalls = 0;
  const provider = http.createServer((req, res) => {
    providerCalls += 1;
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      let payload = {};
      try { payload = JSON.parse(body); } catch {}
      if (payload.input?.target === "success-fixture") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, result: { target: "success-fixture", verifiedBy: "mock-provider" } }));
        return;
      }
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "provider_temporarily_unavailable" }));
    });
  });
  await new Promise(resolve => provider.listen(port, "127.0.0.1", resolve));
  process.env[envNames[0]] = endpoint;
  process.env[envNames[1]] = endpoint;

  try {
    const runtime = new AdapterRuntime({
      tools: [{
        id: "test-adapter",
        layer: "Verification",
        status: "adapter-ready",
        operations: ["inspect"]
      }, {
        id: "test-adapter-two",
        layer: "Verification",
        status: "adapter-ready",
        operations: ["inspect"]
      }]
    });
    const result = await runtime.execute({
      id: "test-adapter",
      operation: "inspect",
      input: { target: "fixture" }
    });

    assert.equal(providerCalls, 1, "non-read-only operation must not be automatically retried");
    assert.equal(result.ok, false, "provider failure must be returned as a failed result");
    assert.equal(result.status, 503);
    assert.equal(result.id, "test-adapter");
    assert.equal(result.operation, "inspect");
    assert.equal(typeof result.requestId, "string");
    assert.ok(result.requestId.length > 0);

    const snapshot = runtime.snapshot();
    assert.equal(snapshot.auditCount, 1, "failed execution must be recorded in audit");
    assert.equal(snapshot.readinessSummary.configured, 2, "both configured adapters remain configured; a failed operation alone is not a health probe");
    assert.equal(snapshot.readinessSummary.executionNotVerified, 2, "neither configured adapter has a successful execution yet");
    const entry = runtime.audit[0];
    assert.equal(entry.ok, false);
    assert.equal(entry.requestId, result.requestId);
    assert.equal(entry.status, 503);
    assert.equal(entry.operation, "inspect");
    assert.equal(entry.timestamp, result.timestamp || entry.timestamp);
    assert.equal(snapshot.adapters[0].runtime.verification.status, "not-verified");

    // Run the same failure contract against a second independently registered adapter.
    const secondResult = await runtime.execute({
      id: "test-adapter-two",
      operation: "inspect",
      input: { target: "second-fixture" }
    });
    assert.equal(providerCalls, 2);
    assert.equal(secondResult.ok, false);
    assert.equal(secondResult.status, 503);
    assert.equal(runtime.snapshot().auditCount, 2);
    assert.equal(runtime.audit[1].requestId, secondResult.requestId);
    assert.equal(runtime.audit[1].id, "test-adapter-two");
    assert.equal(runtime.audit[1].ok, false);

    // A real successful provider response should verify this adapter.
    const successResult = await runtime.execute({
      id: "test-adapter",
      operation: "inspect",
      input: { target: "success-fixture" }
    });
    assert.equal(providerCalls, 3);
    assert.equal(successResult.ok, true);
    assert.equal(successResult.result.verifiedBy, "mock-provider");
    assert.equal(runtime.snapshot().adapters.find(adapter => adapter.id === "test-adapter").runtime.verification.status, "verified");

    // Historical execution success must not hide a later failed health probe.
    runtime.audit.push({
      id: "test-adapter",
      operation: "health",
      ok: false,
      result: { status: "offline" },
      requestId: "later-health-failure",
      timestamp: new Date().toISOString()
    });
    const degradedSnapshot = runtime.snapshot();
    const degradedAdapter = degradedSnapshot.adapters.find(adapter => adapter.id === "test-adapter");
    assert.equal(degradedAdapter.runtime.readiness, "degraded", "latest failed health probe must override historical readiness");
    assert.equal(degradedAdapter.runtime.verification.status, "verified", "historical execution evidence remains available separately");

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "provider-failure-returned-as-structured-result",
        "failed-execution-audited-with-matching-request-id",
        "failed-execution-not-marked-verified",
        "successful-execution-promotes-adapter-to-verified",
        "later-health-failure-overrides-readiness",
        "historical-verification-evidence-is-preserved",
        "non-idempotent-operation-not-retried"
      ],
      adaptersTested: 2,
      successfulExecutions: 1,
      providerCalls,
      auditCount: runtime.snapshot().auditCount,
      httpStatuses: [result.status, secondResult.status]
    }, null, 2));
  } finally {
    for (const name of envNames) {
      if (previousEndpoints[name] === undefined) delete process.env[name];
      else process.env[name] = previousEndpoints[name];
    }
    provider.closeAllConnections?.();
    await new Promise(resolve => provider.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
