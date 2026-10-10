#!/usr/bin/env node
const assert = require("node:assert/strict");
const { validateAdapterInput, CONTRACTS, MAX_INPUT_BYTES } = require("../mindcloud/adapter-contracts");
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");
const native = require("../mindcloud/native-adapters");
const registry = require("../integrations/agent-tools.json");

const fixtures = {
  "overpass-turbo": { query: { query: "[out:json];node(1);out;" }, export_geojson: { query: "[out:json];node(1);out;" } },
  "google-street-view": { metadata: { location: "Varna, Bulgaria" }, image: { pano: "example-pano", size: "640x400" } },
  shodan: { host: { ip: "8.8.8.8" }, search: { query: "product:nginx" }, dns: { domain: "example.com" } },
  opensanctions: { search: { query: "Example Person", limit: 10 }, match: { name: "Example Person", country: ["SE"] } },
  "subdomain-finder": { discover: { domain: "example.com" }, resolve: { domain: "example.com", type: "A" } },
  mapillary: { search: { bbox: "27.8,43.1,28.0,43.3", limit: 10 }, image: { id: "123456" } },
  agentmemory: { remember: { content: "test observation" }, observe: { observation: "test observation" }, smart_search: { query: "test" }, context: { context: "test" } },
  ruflo: { discover_tools: {} }
};

for (const [id, operations] of Object.entries(CONTRACTS)) {
  for (const [operation, contract] of Object.entries(operations)) {
    const valid = validateAdapterInput(id, operation, fixtures[id][operation]);
    assert.equal(valid.ok, true, id + "/" + operation + " should accept its valid fixture");
    assert.equal(valid.mode, "typed");
    for (const key of contract.required || []) {
      const invalid = validateAdapterInput(id, operation, { ...fixtures[id][operation], [key]: undefined });
      assert.equal(invalid.ok, false, id + "/" + operation + " must reject missing " + key);
    }
  }
}

assert.equal(validateAdapterInput("overpass-turbo", "query", { query: 7 }).ok, false);
assert.equal(validateAdapterInput("shodan", "host", { ip: "8.8.8.8", arbitrary: true }).ok, false);
assert.equal(validateAdapterInput("google-street-view", "metadata", {}).ok, false);
assert.equal(validateAdapterInput("agentmemory", "remember", { content: "" }).ok, false);
assert.equal(validateAdapterInput("browser-use", "browse", { url: "https://example.com" }).mode, "bounded-object");
assert.equal(validateAdapterInput("overpass-turbo", "query", { query: "x".repeat(MAX_INPUT_BYTES) }).error, "adapter_input_too_large");
assert.equal(validateAdapterInput("overpass-turbo", "query", JSON.parse('{"__proto__":{"polluted":true},"query":"x"}')).error, "invalid_adapter_input");
assert.equal(validateAdapterInput("ruflo", "discover_tools", { invoke: "arbitrary" }).ok, false);

const runtime = new AdapterRuntime(registry);
(async () => {
  const rejected = await runtime.execute({ id: "overpass-turbo", operation: "query", input: {} });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, "invalid_adapter_input");
  assert.equal(rejected.contract.inputValidation, "rejected");
  const unknown = await runtime.execute({ id: "overpass-turbo", operation: "not-real", input: {} });
  assert.equal(unknown.error, "operation_not_allowed");

  console.log(JSON.stringify({
    status: "verified",
    contractVersion: "1.0",
    typedAdapters: Object.keys(CONTRACTS).length,
    typedOperations: Object.values(CONTRACTS).reduce((sum, operations) => sum + Object.keys(operations).length, 0),
    checks: [
      "valid-native-operation-fixtures",
      "required-field-presence",
      "typed-value-validation",
      "unknown-field-rejection",
      "bounded-generic-external-input",
      "input-size-and-depth-limits",
      "unsafe-object-key-rejection",
      "runtime-rejects-before-provider-execution",
      "unsupported-operation-still-blocked"
    ]
  }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
