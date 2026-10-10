#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");

const appPort = 39137;
const providerPort = 39138;
const appBase = `http://127.0.0.1:${appPort}`;
const token = "mindcloud-adapter-route-test-token";

function listen(server, port) {
  return new Promise(resolve => server.listen(port, "127.0.0.1", resolve));
}
async function json(response) {
  return { status: response.status, body: await response.json() };
}
async function waitHealthy(child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(appBase + "/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("MindCloud server did not become healthy");
}

(async () => {
  const provider = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({status:"ok"}));
      return;
    }
    if (req.method === "POST" && req.url === "/api/v1/remember") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        assert.match(body, /session_id/);
        assert.ok(body.includes("agentmemory route test") || body.includes("MINDCLOUD_PERSISTENCE_PROBE_V1"),
          "mock Cognee must accept both the startup persistence probe and AgentMemory route test");
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({status:"added",session_stored:true}));
      });
      return;
    }
    if (req.method === "POST" && req.url === "/api/v1/recall") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        const query = JSON.parse(body);
        res.writeHead(200, { "content-type": "application/json" });
        if (query.session_id === "mindcloud-e2e-persistence-probe") {
          res.end(JSON.stringify({results:[{text:"MINDCLOUD_PERSISTENCE_PROBE_V1"}],query:query.query}));
          return;
        }
        assert.equal(query.session_id, "agentmemory-route-test");
        res.end(JSON.stringify({results:[{text:"agentmemory route test"}],query:query.query}));
      });
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/crt.sh?")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([{name_value:"api.example.com\nosiris.example.com\nnotexample.com"}]));
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/dns-query?")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({Status:0,Answer:[{name:"api.example.com",type:1,data:"203.0.113.12",TTL:60}]}));
      return;
    }
    if (req.method !== "POST" || req.url !== "/api/interpreter") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      assert.match(body, /data=/);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ elements: [
        { type: "node", id: 7, lat: 43.2, lon: 27.9, tags: { name: "Varna test point" } },
        { type: "way", id: 8, geometry: [{ lat: 43.2, lon: 27.9 }, { lat: 43.21, lon: 27.91 }], tags: { highway: "residential" } }
      ] }));
    });
  });
  await listen(provider, providerPort);

  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(appPort),
      CCTV_SOURCE_URL: "",
      COGNEE_SERVICE_URL: `http://127.0.0.1:${providerPort}`,
      OVERPASS_API_URL: `http://127.0.0.1:${providerPort}/api/interpreter`,
      CRT_SH_URL: `http://127.0.0.1:${providerPort}/crt.sh`,
      CLOUDFLARE_DNS_URL: `http://127.0.0.1:${providerPort}/dns-query`,
      MINDCLOUD_AUTHORIZED_DOMAINS: "example.com",
      MINDCLOUD_TOOL_EXECUTION_TOKEN: token
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });

  try {
    await waitHealthy(child);

    const denied = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "overpass-turbo", operation: "export_geojson", input: { query: "[out:json];out;" } })
    }));
    assert.equal(denied.status, 401, "adapter route must reject missing bearer token");

    const executed = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ id: "overpass-turbo", operation: "export_geojson", input: { query: "[out:json];out;" } })
    }));
    assert.equal(executed.status, 200);
    assert.equal(executed.body.ok, true);
    assert.equal(executed.body.result.type, "FeatureCollection");
    assert.equal(executed.body.result.features.length, 2);
    assert.deepEqual(executed.body.result.features[0].geometry, { type: "Point", coordinates: [27.9, 43.2] });
    assert.deepEqual(executed.body.result.features[1].geometry, { type: "LineString", coordinates: [[27.9, 43.2], [27.91, 43.21]] });
    assert.equal(typeof executed.body.evidence.requestId, "string");
    assert.ok(executed.body.evidence.requestId.length > 0);
    assert.equal(executed.body.evidence.source, `http://127.0.0.1:${providerPort}/api/interpreter`);

    const blockedScope = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ id: "subdomain-finder", operation: "discover", input: { domain: "example.net" } })
    }));
    assert.equal(blockedScope.status, 200);
    assert.equal(blockedScope.body.error, "human_approval_required", "unallowlisted domains must remain blocked");

    const discovered = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ id: "subdomain-finder", operation: "discover", input: { domain: "example.com" } })
    }));
    assert.equal(discovered.status, 200);
    assert.equal(discovered.body.ok, true);
    assert.deepEqual(discovered.body.result.subdomains, ["api.example.com", "osiris.example.com"]);
    assert.equal(discovered.body.result.method, "passive-certificate-transparency");

    const resolved = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ id: "subdomain-finder", operation: "resolve", input: { domain: "example.com", name: "api.example.com", type: "A" } })
    }));
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.ok, true);
    assert.equal(resolved.body.result.answers[0].data, "203.0.113.12");
    const memoryHealth = await json(await fetch(appBase + "/api/adapters/agentmemory/health"));
    assert.equal(memoryHealth.status, 200);
    assert.equal(memoryHealth.body.status, "healthy");
    const memoryWrite = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ id: "agentmemory", operation: "remember", input: { content: "agentmemory route test", sessionId: "agentmemory-route-test" } })
    }));
    assert.equal(memoryWrite.status, 200);
    assert.equal(memoryWrite.body.ok, true);
    assert.equal(memoryWrite.body.evidence.sessionId, "agentmemory-route-test");
    const memoryRecall = await json(await fetch(appBase + "/api/adapters/execute", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + token },
      body: JSON.stringify({ id: "agentmemory", operation: "smart_search", input: { query: "agentmemory route test", sessionId: "agentmemory-route-test" } })
    }));
    assert.equal(memoryRecall.status, 200);
    assert.equal(memoryRecall.body.ok, true);
    assert.equal(memoryRecall.body.result.results[0].text, "agentmemory route test");
    assert.equal(memoryRecall.body.evidence.sessionId, "agentmemory-route-test");

    const snapshot = await json(await fetch(appBase + "/api/adapters"));
    assert.equal(snapshot.status, 200);
    assert.ok(snapshot.body.auditCount >= 6, "adapter audit must include the explicit route calls; startup self-test may add its own record");
    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "adapter-route-bearer-auth",
        "real-http-route-to-native-adapter",
        "provider-http-request",
        "Overpass-JSON-to-GeoJSON-node-and-way",
        "evidence-request-id-and-source",
        "adapter-audit-recorded",
        "subdomain-domain-allowlist-gate",
        "passive-certificate-transparency-discovery",
        "free-dns-over-https-resolution",
        "Cognee-backed-AgentMemory-health",
        "AgentMemory-write-through-protected-adapter-route",
        "AgentMemory-session-scoped-recall-and-evidence"
      ]
    }, null, 2));
  } catch (error) {
    console.error(stderr);
    console.error(error);
    process.exitCode = 1;
  } finally {
    child.kill("SIGKILL");
    provider.closeAllConnections?.();
    await new Promise(resolve => provider.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
