#!/usr/bin/env node
const assert = require("node:assert/strict");

const base = (process.env.MINDCLOUD_PRODUCTION_URL || "https://mindcloud-live.up.railway.app").replace(/\/$/, "");
const timeout = 10000;

async function getJson(path) {
  const response = await fetch(base + path, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeout)
  });
  const contentType = response.headers.get("content-type") || "";
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  assert.match(contentType, /application\/json/i, `${path} did not return JSON`);
  return response.json();
}

(async () => {
  const health = await getJson("/health");
  assert.equal(health.status, "ok");

  const status = await getJson("/api/mindcloud/status");
  assert.ok(Array.isArray(status.tasks), "MindCloud status missing task registry");

  const adapters = await getJson("/api/adapters");
  assert.equal(adapters.type, "mindcloud_adapter_runtime");
  assert.deepEqual(adapters.lifecycle, ["discover", "health", "execute", "result", "audit"]);
  assert.ok(Array.isArray(adapters.adapters), "adapter registry missing");

  const cctv = await getJson("/api/cctv");
  assert.equal(cctv.endpoint, "/api/cctv");
  assert.ok(["configured", "not_configured"].includes(cctv.status), "CCTV must report explicit configuration state");
  assert.equal(cctv.proxyStatus, "implemented", "CCTV proxy implementation must be present");
  assert.ok(["configured", "credentials-missing"].includes(cctv.proxyAuthStatus), "CCTV proxy auth state must be explicit");
  assert.ok(["unconfigured", "unverified", "verified"].includes(cctv.streamStatus), "CCTV stream state must be explicit");
  assert.ok(["unconfigured", "not_implemented", "verified"].includes(cctv.frameStatus), "CCTV frame state must be explicit");
  assert.ok(["unavailable", "not_verified", "verified"].includes(cctv.evidenceStatus), "CCTV evidence state must be explicit");

  const runtime = await getJson("/api/runtime/status");
  assert.equal(runtime.type, "mindcloud_runtime_status");
  assert.equal(runtime.coreHealth, "ok");
  assert.ok(runtime.mindcloud && runtime.memory && runtime.cctv, "runtime status missing component state");

  const overpass = await getJson("/api/adapters/overpass-turbo/health");
  assert.equal(overpass.status, "healthy", "live Overpass provider health failed: " + JSON.stringify(overpass));

  const freeSubdomain = await getJson("/api/adapters/subdomain-finder/health");
  assert.equal(freeSubdomain.status, "configured", "free passive subdomain adapter must be available");
  const mapillary = await getJson("/api/adapters/mapillary/health");
  assert.ok(["credentials-missing", "configured"].includes(mapillary.status), "Mapillary must report explicit free-token state");

  const credentialGatedAdapters = {};
  for (const id of ["google-street-view", "shodan", "opensanctions"]) {
    const health = await getJson("/api/adapters/" + id + "/health");
    assert.ok(["credentials-missing", "configured"].includes(health.status), id + " did not report an explicit credential state");
    credentialGatedAdapters[id] = health.status;
  }

  const unauthenticated = await fetch(base + "/api/adapters/execute", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ id: "overpass-turbo", operation: "query", input: { query: "[out:json];out;" } }),
    signal: AbortSignal.timeout(timeout)
  });
  assert.equal(unauthenticated.status, 401, "adapter execution must reject requests without a bearer token");

  console.log(JSON.stringify({
    status: "production-smoke-passed",
    base,
    checks: [
      "health-http-200",
      "mindcloud-status-json",
      "adapter-registry-and-lifecycle",
      "cctv-explicit-state",
      "runtime-component-status",
      "live-overpass-provider-health",
      "free-passive-subdomain-adapter",
      "mapillary-free-token-state",
      "credential-gated-adapter-state",
      "adapter-execution-rejects-unauthenticated-request"
    ],
    memoryStatus: runtime.memory.status,
    cctvStatus: cctv.status,
    cctvProxyStatus: cctv.proxyStatus,
    overpassStatus: overpass.status,
    freeSubdomainStatus: freeSubdomain.status,
    mapillaryStatus: mapillary.status,
    credentialGatedAdapters
  }, null, 2));
})().catch(error => {
  console.error(JSON.stringify({
    status: "production-smoke-failed",
    base,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
});
