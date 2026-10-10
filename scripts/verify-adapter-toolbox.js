const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");
const registry = JSON.parse(fs.readFileSync("integrations/agent-tools.json", "utf8"));
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");
const native = require("../mindcloud/native-adapters");

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
  assert.ok(Array.isArray(adapter.runtime.executableOperations),
    "every adapter must publish the operations executable in its current configuration");
  if (native.supports(adapter.id)) {
    const expected = [...native.operationsFor(adapter.id), ...(registry.tools.find(tool=>tool.id===adapter.id).operations.includes("health")?["health"]:[])];
    assert.deepEqual(adapter.runtime.operations,expected,
      "native adapters must not advertise operations that their implementation cannot execute: "+adapter.id);
  }
}
assert.deepEqual(runtime.discover("overpass-turbo").adapter.operations,["query","export_geojson","health"]);
assert.deepEqual(runtime.discover("shodan").adapter.operations,["host","search","dns","health"]);
assert.deepEqual(runtime.discover("ruflo").adapter.operations,["discover_tools","health"]);
console.log("adapter-toolbox: verified UI syntax, lifecycle controls, native operation conformance, executable operation inventory, and protected execution boundary");
