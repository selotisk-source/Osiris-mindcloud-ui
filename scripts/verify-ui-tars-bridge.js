#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const registry = require("../integrations/agent-tools.json");
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");

(async () => {
  const saved = {
    endpoint: process.env.UI_TARS_SERVICE_URL,
    key: process.env.UI_TARS_API_KEY
  };
  const calls = [];
  try {
    delete process.env.UI_TARS_SERVICE_URL;
    delete process.env.UI_TARS_API_KEY;
    const unconfigured = new AdapterRuntime(registry);
    const missing = unconfigured.discover("ui-tars");
    assert.equal(missing.ok, true);
    assert.equal(missing.adapter.runtime.readiness, "registered-only");
    assert.deepEqual(missing.adapter.runtime.missingConfiguration.sort(), ["UI_TARS_API_KEY", "UI_TARS_SERVICE_URL"].sort());

    process.env.UI_TARS_SERVICE_URL = "https://ui-tars-worker.test";
    process.env.UI_TARS_API_KEY = "test-ui-tars-token";
    const runtime = new AdapterRuntime(registry);
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/health")) {
        return { ok: true, status: 200, json: async () => ({ status: "healthy", worker: "ui-tars-sdk-test" }) };
      }
      return {
        ok: true,
        status: 202,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({ accepted: true, run_id: "ui-run-123", state: "queued" })
      };
    };
    try {
      const health = await runtime.execute({ id: "ui-tars", operation: "health", input: {} });
      assert.equal(health.ok, true);
      assert.equal(calls[0].url, "https://ui-tars-worker.test/health");
      assert.equal(calls[0].options.headers.authorization, "Bearer test-ui-tars-token");

      const blocked = await runtime.execute({
        id: "ui-tars", operation: "run", input: { task: "Open the approved test page" }
      });
      assert.equal(blocked.ok, false);
      assert.equal(blocked.error, "human_approval_required");
      assert.equal(calls.length, 1, "unapproved GUI work must not reach the worker");

      const accepted = await runtime.execute({
        id: "ui-tars", operation: "run", approved: true,
        input: { task: "Open the approved test page", max_steps: 3 }
      });
      assert.equal(accepted.ok, true);
      assert.equal(accepted.status, 202);
      assert.equal(accepted.result.run_id, "ui-run-123");
      assert.equal(calls[1].url, "https://ui-tars-worker.test/execute");
      assert.equal(calls[1].options.headers.authorization, "Bearer test-ui-tars-token");
      const body = JSON.parse(calls[1].options.body);
      assert.equal(body.operation, "run");
      assert.equal(body.input.task, "Open the approved test page");
      assert.equal(body.requestId, accepted.requestId);
      assert.equal(runtime.snapshot().adapters.find(item => item.id === "ui-tars").runtime.verification.status, "verified");
    } finally {
      global.fetch = originalFetch;
    }
    console.log(JSON.stringify({
      status: "passed",
      checks: [
        "unconfigured-worker-remains-registered-only",
        "health-probe-uses-bearer-auth",
        "gui-execution-blocked-without-approval",
        "approved-run-forwards-typed-payload",
        "request-id-correlates-worker-call-and-audit",
        "successful-call-updates-runtime-verification"
      ]
    }, null, 2));
  } finally {
    if (saved.endpoint === undefined) delete process.env.UI_TARS_SERVICE_URL;
    else process.env.UI_TARS_SERVICE_URL = saved.endpoint;
    if (saved.key === undefined) delete process.env.UI_TARS_API_KEY;
    else process.env.UI_TARS_API_KEY = saved.key;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
