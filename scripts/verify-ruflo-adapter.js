#!/usr/bin/env node
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough, Writable } = require("node:stream");
const { discoverTools } = require("../mindcloud/ruflo-mcp");
const native = require("../mindcloud/native-adapters");
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");
const registry = require("../integrations/agent-tools.json");

function fakeSpawn(command, args, options) {
  assert.equal(command, "npx");
  assert.deepEqual(args, ["--yes", "ruflo@3.56.3", "mcp", "start"]);
  assert.equal(options.env.OPENAI_API_KEY, undefined, "provider secrets must not be inherited by RuFlo");
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({
    write(chunk, encoding, callback) {
      const line = chunk.toString().trim();
      callback();
      if (!line.startsWith("{")) return;
      const message = JSON.parse(line);
      if (message.id == null) return;
      setImmediate(() => {
        let result;
        if (message.method === "initialize") result = {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "ruflo", version: "3.56.3" },
          capabilities: { tools: {} }
        };
        else if (message.method === "tools/list") result = {
          tools: [
            { name: "ruflo_status", description: "Read-only runtime status", inputSchema: { type: "object", properties: { detail: { type: "boolean" } } } },
            { name: "ruflo_route", description: "Inspect routing without running a task", inputSchema: { type: "object", properties: { goal: { type: "string" } } } }
          ]
        };
        else result = {};
        child.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\n");
      });
    }
  });
  child.kill = () => true;
  return child;
}

(async () => {
  const report = await discoverTools({
    spawnFn: fakeSpawn,
    timeoutMs: 1000,
    env: { PATH: "/usr/bin", HOME: "/tmp", OPENAI_API_KEY: "must-not-leak" }
  });
  assert.equal(report.ok, true);
  assert.equal(report.server.name, "ruflo");
  assert.equal(report.toolCount, 2);
  assert.deepEqual(report.tools.map(tool => tool.name), ["ruflo_status", "ruflo_route"]);
  assert.equal(report.executionEnabled, false);
  assert.equal(report.tools[0].inputKeys[0], "detail");

  process.env.RUFLO_MCP_ENABLED = "false";
  assert.equal(native.supports("ruflo"), true);
  assert.equal(native.state("ruflo").configured, false);
  assert.equal(native.state("ruflo").required, "RUFLO_MCP_ENABLED=true");
  const disabledHealth = await native.health("ruflo");
  assert.equal(disabledHealth.status, "disabled");

  const runtime = new AdapterRuntime(registry);
  const discovered = runtime.discover("ruflo");
  assert.equal(discovered.ok, true);
  assert.equal(discovered.adapter.runtime.state, "registered-only");
  assert.deepEqual(discovered.adapter.runtime.operations, ["discover_tools", "health"]);
  const denied = await runtime.execute({ id: "ruflo", operation: "invoke_tool", input: { name: "ruflo_run", arguments: { task: "do something" } } });
  assert.equal(denied.error, "operation_not_allowed");
  assert.equal(denied.ok, false);

  console.log(JSON.stringify({
    status: "verified",
    checks: [
      "ruflo-mcp-initialize-and-tools-list",
      "provider-secrets-not-inherited",
      "tool-discovery-output-bounded-and-summarized",
      "adapter-disabled-by-default",
      "runtime-registers-readonly-operations-only",
      "arbitrary-tool-invocation-blocked"
    ],
    discoveredTools: report.toolCount,
    executionEnabled: report.executionEnabled
  }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
