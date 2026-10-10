const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");
const registry = JSON.parse(fs.readFileSync("integrations/agent-tools.json", "utf8"));
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");

const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());
assert.ok(scripts.length > 0, "UI must contain an executable script");
for (const [index, source] of scripts.entries()) {
  assert.doesNotThrow(() => new vm.Script(source, { filename: "index-inline-" + index + ".js" }),
    "inline UI script " + index + " must parse");
}

assert.match(html, /fetch\('\/api\/adapters'/, "toolbox must read the live adapter runtime");
assert.match(html, /data-adapter-action="health"/, "each adapter card must expose a live health action");
assert.match(html, /data-adapter-action="discover"/, "each adapter card must expose a discovery action");
assert.match(html, /registered-only adapters are not presented as running applications/i,
  "UI must distinguish a registry contract from a running adapter");
assert.match(html, /adapterHealthCache\[id\]=result/, "health result must be retained in the UI");
assert.match(html, /adapterDiscoveryCache\[id\]=result/, "discovery result must be retained in the UI");
assert.doesNotMatch(html, /fetch\(['"]\/api\/adapters\/execute/, "browser UI must not call the protected execution endpoint or expose its token");

const runtime = new AdapterRuntime(registry);
const snapshot = runtime.snapshot();
assert.equal(snapshot.adapters.length, registry.tools.length, "runtime status must cover every registered adapter");
for (const adapter of snapshot.adapters) {
  assert.ok(adapter.id, "every adapter needs a stable ID");
  assert.ok(["configured", "registered-only"].includes(adapter.runtime.state),
    "every adapter must report a truthful runtime state");
  assert.ok(Array.isArray(adapter.runtime.operations),
    "every adapter must publish supported operation contracts");
}
console.log("adapter-toolbox: verified inline UI syntax, live health/discovery controls, truthful runtime states, and protected execution boundary");
