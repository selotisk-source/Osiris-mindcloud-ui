#!/usr/bin/env node
const assert = require("node:assert/strict");
const http = require("node:http");
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");

(async () => {
  const port = 39149;
  const endpoint = `http://127.0.0.1:${port}`;
  const envName = "ADAPTER_TEST_ADAPTER_URL";
  const previousEndpoint = process.env[envName];
  let providerCalls = 0;
  const provider = http.createServer((req, res) => {
    providerCalls += 1;
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "provider_temporarily_unavailable" }));
  });
  await new Promise(resolve => provider.listen(port, "127.0.0.1", resolve));
  process.env[envName] = endpoint;

  try {
    const runtime = new AdapterRuntime({
      tools: [{
        id: "test-adapter",
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
    assert.equal(snapshot.readinessSummary.degraded, 1, "failed health is separate; failed execution alone must not claim verified");
    const entry = runtime.audit[0];
    assert.equal(entry.ok, false);
    assert.equal(entry.requestId, result.requestId);
    assert.equal(entry.status, 503);
    assert.equal(entry.operation, "inspect");
    assert.equal(entry.timestamp, result.timestamp || entry.timestamp);
    assert.equal(snapshot.adapters[0].runtime.verification.status, "not-verified");

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "provider-failure-returned-as-structured-result",
        "failed-execution-audited-with-matching-request-id",
        "failed-execution-not-marked-verified",
        "non-idempotent-operation-not-retried"
      ],
      providerCalls,
      auditCount: snapshot.auditCount,
      httpStatus: result.status
    }, null, 2));
  } finally {
    if (previousEndpoint === undefined) delete process.env[envName];
    else process.env[envName] = previousEndpoint;
    provider.closeAllConnections?.();
    await new Promise(resolve => provider.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
