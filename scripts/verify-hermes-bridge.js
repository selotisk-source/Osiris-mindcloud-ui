#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");
const registry = require("../integrations/agent-tools.json");
const bridge = require("../mindcloud/hermes-bridge");
const native = require("../mindcloud/native-adapters");
const { validateAdapterInput } = require("../mindcloud/adapter-contracts");

(async () => {
  const originalUrl = process.env.HERMES_SERVICE_URL;
  const originalKey = process.env.HERMES_API_KEY;
  const originalFetch = global.fetch;
  try {
    delete process.env.HERMES_SERVICE_URL;
    delete process.env.HERMES_API_KEY;
    assert.equal(bridge.state().configured, false);
    assert.deepEqual(bridge.state().required, ["HERMES_SERVICE_URL", "HERMES_API_KEY"]);

    process.env.HERMES_SERVICE_URL = "http://hermes-agent.railway.internal:8642";
    process.env.HERMES_API_KEY = "test-only-key";
    assert.equal(native.supports("hermes-agent"), true);
    assert.equal(bridge.state().configured, true);
    assert.deepEqual(native.operationsFor("hermes-agent"), ["health", "capabilities", "submit_run", "get_run", "stop_run", "approve_run"]);

    assert.equal(validateAdapterInput("hermes-agent", "submit_run", { input: "Inspect MindCloud" }).ok, true);
    assert.equal(validateAdapterInput("hermes-agent", "submit_run", {}).ok, false);
    assert.equal(validateAdapterInput("hermes-agent", "get_run", { run_id: "../secrets" }).ok, true,
      "generic contract is bounded; run-id path safety is enforced by the adapter");
    assert.equal(bridge.validateRunId("../secrets"), null);

    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/health")) return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      if (url.endsWith("/v1/capabilities")) return new Response(JSON.stringify({ endpoints: { runs: true } }), { status: 200 });
      if (url.endsWith("/v1/runs")) return new Response(JSON.stringify({ run_id: "run_test_123", status: "started" }), { status: 202 });
      if (url.endsWith("/v1/runs/run_test_123")) return new Response(JSON.stringify({ run_id: "run_test_123", status: "completed", output: "ready" }), { status: 200 });
      if (url.endsWith("/v1/runs/run_test_123/stop")) return new Response(JSON.stringify({ status: "stopping" }), { status: 200 });
      if (url.endsWith("/v1/runs/run_test_123/approval")) return new Response(JSON.stringify({ status: "approved" }), { status: 200 });
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    };

    const health = await bridge.health();
    assert.equal(health.ok, true);
    const caps = await bridge.execute({ operation: "capabilities" });
    assert.equal(caps.ok, true);
    const started = await bridge.execute({ operation: "submit_run", input: { input: "Inspect MindCloud" }, requestId: "mc-test-1" });
    assert.equal(started.ok, true);
    assert.equal(started.result.run_id, "run_test_123");
    const polled = await bridge.execute({ operation: "get_run", input: { run_id: "run_test_123" } });
    assert.equal(polled.result.status, "completed");
    const stopped = await bridge.execute({ operation: "stop_run", input: { run_id: "run_test_123" } });
    assert.equal(stopped.ok, true);
    const approved = await bridge.execute({ operation: "approve_run", input: { run_id: "run_test_123", request_id: "prompt-1", execution_generation: 2, choice: "once" } });
    assert.equal(approved.ok, true);
    assert.equal(calls.every(call => call.options.headers.authorization === "Bearer test-only-key"), true);
    assert.equal(calls.find(call => call.url.endsWith("/v1/runs")).options.headers["idempotency-key"], "mc-test-1");

    const runtime = new AdapterRuntime(registry);
    assert.equal(runtime.list().find(item => item.id === "hermes-agent").runtime.operations.includes("health"), true);
    const denied = await runtime.execute({ id: "hermes-agent", operation: "submit_run", input: { input: "Run task" }, approved: false });
    assert.equal(denied.error, "human_approval_required");
    const allowed = await runtime.execute({ id: "hermes-agent", operation: "submit_run", input: { input: "Run task" }, approved: true });
    assert.equal(allowed.ok, true);

    console.log(JSON.stringify({
      status: "passed",
      checks: [
        "required-configuration-fails-closed",
        "private-service-url-configuration",
        "native-adapter-registration",
        "typed-input-contracts",
        "run-id-path-validation",
        "authenticated-health-and-capabilities",
        "idempotent-run-submission",
        "run-status-stop-and-approval-contracts",
        "sensitive-operations-require-human-approval"
      ],
      httpCalls: calls.length
    }, null, 2));
  } finally {
    if (originalUrl === undefined) delete process.env.HERMES_SERVICE_URL; else process.env.HERMES_SERVICE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.HERMES_API_KEY; else process.env.HERMES_API_KEY = originalKey;
    global.fetch = originalFetch;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
