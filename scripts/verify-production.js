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

  const arenaResponse = await fetch(base + "/api/mindcloud/arena/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      task: "Production Arena API smoke test",
      candidates: [
        {
          id: "production-pass",
          approach: "All acceptance tests pass",
          tests: [{ id: "api-contract", passed: true, evidenceRef: "smoke://arena/api-contract" }],
          requiredChecks: [{ id: "safety", passed: true }]
        },
        {
          id: "production-fail",
          approach: "Acceptance test fails",
          tests: [{ id: "api-contract", passed: false, evidenceRef: "smoke://arena/api-contract-fail" }],
          requiredChecks: [{ id: "safety", passed: true }]
        }
      ]
    }),
    signal: AbortSignal.timeout(timeout)
  });
  assert.equal(arenaResponse.status, 200, "Arena evaluation API must respond HTTP 200");
  const arena = await arenaResponse.json();
  assert.equal(arena.type, "mindcloud_arena_report");
  assert.equal(arena.status, "verified_winner");
  assert.equal(arena.winnerId, "production-pass");
  assert.equal(arena.promotion.allowed, false, "production smoke must not promote a skill");
  const arenaInvalidResponse = await fetch(base + "/api/mindcloud/arena/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ task: "invalid request", candidates: [] }),
    signal: AbortSignal.timeout(timeout)
  });
  assert.equal(arenaInvalidResponse.status, 400, "Arena API must reject invalid candidate sets");
  const arenaInvalid = await arenaInvalidResponse.json();
  assert.equal(arenaInvalid.error, "arena_requires_competing_candidates");

  const adapters = await getJson("/api/adapters");
  assert.equal(adapters.type, "mindcloud_adapter_runtime");
  assert.deepEqual(adapters.lifecycle, ["discover", "health", "execute", "result", "audit"]);
  assert.ok(Array.isArray(adapters.adapters), "adapter registry missing");

  const agentTools = await getJson("/api/agent-tools");
  assert.ok(Array.isArray(agentTools.tools), "agent tool catalog missing");
  const expectedCandidates = ["watermelon-ui", "watermelon-ai", "manus-ai", "punkt-ai"];
  const toolIds = new Set(agentTools.tools.map(tool => tool.id));
  for (const id of expectedCandidates) {
    assert.ok(toolIds.has(id), "registered tool candidate missing: " + id);
    const adapter = adapters.adapters.find(item => item.id === id);
    assert.ok(adapter, "adapter runtime missing catalog candidate: " + id);
    assert.equal(adapter.runtime.state, "registered-only",
      id + " must not be presented as executable before a runtime adapter is verified");
  }

  const metanoiaUnauthenticated = await fetch(base + "/api/mindcloud/metanoia/approve", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(timeout)
  });
  assert.equal(metanoiaUnauthenticated.status, 401,
    "Metanoia version transition must reject unauthenticated approval");

  const cctv = await getJson("/api/cctv");
  assert.equal(cctv.endpoint, "/api/cctv");
  assert.ok(["configured", "not_configured"].includes(cctv.status), "CCTV must report explicit configuration state");
  assert.equal(cctv.proxyStatus, "implemented", "CCTV proxy implementation must be present");
  assert.ok(["configured", "credentials-missing"].includes(cctv.proxyAuthStatus), "CCTV proxy auth state must be explicit");
  assert.ok(["unconfigured", "unverified", "verified"].includes(cctv.streamStatus), "CCTV stream state must be explicit");
  assert.ok(["unconfigured", "not_implemented", "unverified", "verified"].includes(cctv.frameStatus), "CCTV frame state must be explicit");
  assert.ok(["unavailable", "not_verified", "verified", "snapshot-hash-recorded"].includes(cctv.evidenceStatus), "CCTV evidence state must be explicit");
  // During a rolling deployment, the currently-live API may not expose the new snapshot fields yet.
  if (cctv.snapshotStatus !== undefined) {
    assert.ok(["not_configured", "not_checked", "verified", "failed", "not_a_snapshot"].includes(cctv.snapshotStatus), "CCTV snapshot probe state must be explicit");
    if (cctv.snapshotStatus === "verified") {
      assert.equal(cctv.frameStatus, "verified", "verified snapshot probe must be reflected in the CCTV status endpoint");
      assert.match(cctv.snapshotSha256 || "", /^[a-f0-9]{64}$/, "verified snapshot must expose a SHA-256 digest");
      assert.ok(cctv.snapshotByteLength > 0, "verified snapshot must expose byte length");
    }
  }

  const selftestResponse = await fetch(base + "/api/mindcloud/selftest", {
    method: "POST",
    headers: { accept: "application/json" },
    // The self-test runs sequential probes; Cognee write + three readback attempts alone can take up to 80s.
    signal: AbortSignal.timeout(150000)
  });
  const selftest = await selftestResponse.json();
  assert.equal(selftestResponse.status, 200, "production MindCloud self-test must return HTTP 200: " + JSON.stringify(selftest));
  assert.equal(selftest.type, "mindcloud_e2e_selftest");
  assert.equal(selftest.integrations?.memory?.status, "healthy", "Cognee health must pass in production");
  assert.equal(selftest.integrations?.memoryRoundTrip?.status, "healthy",
    "Cognee write/readback round-trip must pass in production: " + JSON.stringify(selftest.integrations?.memoryRoundTrip));
  assert.equal(selftest.integrations.memoryRoundTrip.persisted, true,
    "production Cognee readback must return the unique marker");
  assert.equal(selftest.integrations.memoryRoundTrip.mode, "write-readback");
  assert.match(selftest.integrations.memoryRoundTrip.markerHash || "", /^[a-f0-9]{64}$/);

  const runtime = await getJson("/api/runtime/status");
  assert.equal(runtime.type, "mindcloud_runtime_status");
  assert.equal(runtime.coreHealth, "ok");
  assert.ok(runtime.mindcloud && runtime.memory && runtime.cctv, "runtime status missing component state");

  // Third-party provider outages should remain visible without masking our own API checks.
  let overpass;
  let overpassWarning = null;
  try {
    overpass = await getJson("/api/adapters/overpass-turbo/health");
    assert.ok(["healthy", "degraded", "offline"].includes(overpass.status),
      "Overpass must return an explicit provider health state: " + JSON.stringify(overpass));
    assert.equal(overpass.probe, "interpreter-json", "Overpass health must identify the live probe");
    if (overpass.status !== "healthy") {
      assert.ok(overpass.error || overpass.httpStatus, "unhealthy Overpass status must include diagnostic detail");
      overpassWarning = "Overpass provider degraded: " + JSON.stringify(overpass);
    }
  } catch (error) {
    overpassWarning = "Overpass health endpoint unavailable: " + (error instanceof Error ? error.message : String(error));
  }

  const agentMemory = await getJson("/api/adapters/agentmemory/health");
  assert.equal(agentMemory.status, "healthy", "Cognee-backed AgentMemory adapter must be live: " + JSON.stringify(agentMemory));
  const agentMemoryContract = await getJson("/api/adapters/agentmemory/discover");
  assert.equal(agentMemoryContract.ok, true, "AgentMemory runtime contract must be discoverable");
  assert.deepEqual(agentMemoryContract.adapter.operations, ["remember", "observe", "smart_search", "context"]);

  const freeSubdomain = await getJson("/api/adapters/subdomain-finder/health");
  assert.ok(["configured", "authorization-scope-missing"].includes(freeSubdomain.status), "free passive subdomain adapter must report either a configured scope or an explicit missing-allowlist state");
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
      "arena-production-post-and-fail-closed-contract",
      "mindcloud-status-json",
      "adapter-registry-and-lifecycle",
      "incoming-tool-candidates-registered-with-honest-runtime-state",
      "metanoia-version-transition-rejects-unauthenticated-approval",
      "cctv-explicit-state",
      "runtime-component-status",
      "production-cognee-write-readback-round-trip",
      "live-overpass-provider-health-state-and-diagnostics-with-degradation-tolerance",
      "agentmemory-cognee-live-health-and-discovery",
      "free-passive-subdomain-adapter",
      "mapillary-free-token-state",
      "credential-gated-adapter-state",
      "adapter-execution-rejects-unauthenticated-request"
    ],
    memoryStatus: runtime.memory.status,
    cctvStatus: cctv.status,
    cctvProxyStatus: cctv.proxyStatus,
    warnings: overpassWarning ? [overpassWarning] : [],
    overpassStatus: overpass?.status || "unavailable",
    agentMemoryStatus: agentMemory.status,
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
