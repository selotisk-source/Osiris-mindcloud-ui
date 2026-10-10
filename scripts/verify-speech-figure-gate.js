#!/usr/bin/env node
const assert = require("node:assert/strict");
const registry = require("../integrations/agent-tools.json");
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");

(async () => {
  const tool = registry.tools.find(item => item.id === "speech-figure");
  assert.ok(tool, "Speech Figure must remain registered as a capability candidate");
  assert.equal(tool.status, "research-registered", "Speech Figure must not be promoted before runtime and license gates pass");
  assert.equal(tool.layer, "VoiceAndVisualization");
  assert.ok(Array.isArray(tool.operations) && tool.operations.includes("start_session"));
  assert.match(tool.license, /PolyForm Noncommercial/i);
  assert.match(tool.promotion_gate, /license-clearance/);

  const previousEndpoint = process.env.ADAPTER_SPEECH_FIGURE_URL;
  process.env.ADAPTER_SPEECH_FIGURE_URL = "http://127.0.0.1:1";
  try {
    const runtime = new AdapterRuntime(registry);
    const discovery = runtime.discover("speech-figure");
    assert.equal(discovery.ok, true);
    assert.equal(discovery.adapter.runtime.state, "registered-only",
      "a configured endpoint must not activate a research-only capability");
    assert.equal(discovery.adapter.runtime.executable, false);
    assert.deepEqual(discovery.adapter.runtime.executableOperations, [],
      "research-only operations must not be advertised as executable");

    const blocked = await runtime.execute({
      id: "speech-figure",
      operation: "start_session",
      input: { locale: "sv-SE", camera_enabled: false }
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error, "capability_not_promoted");
    assert.equal(blocked.executionEnabled, false);

    const health = await runtime.health("speech-figure");
    assert.equal(health.ok, false);
    assert.equal(health.status, "research-registered");
    assert.equal(health.executionEnabled, false);
  } finally {
    if (previousEndpoint === undefined) delete process.env.ADAPTER_SPEECH_FIGURE_URL;
    else process.env.ADAPTER_SPEECH_FIGURE_URL = previousEndpoint;
  }
  console.log("speech-figure-gate: verified research-only registration, license gate, no endpoint-based activation, and blocked execution");
})().catch(error => { console.error(error); process.exitCode = 1; });
