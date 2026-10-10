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
      PORT: String(appPort),
      CCTV_SOURCE_URL: "",
      COGNEE_SERVICE_URL: "",
      OVERPASS_API_URL: `http://127.0.0.1:${providerPort}/api/interpreter`,
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
    assert.equal(executed.body.evidence.requestId, executed.body.requestId);
    assert.equal(executed.body.evidence.source, `http://127.0.0.1:${providerPort}/api/interpreter`);

    const snapshot = await json(await fetch(appBase + "/api/adapters"));
    assert.equal(snapshot.status, 200);
    assert.equal(snapshot.body.auditCount, 1);
    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "adapter-route-bearer-auth",
        "real-http-route-to-native-adapter",
        "provider-http-request",
        "Overpass-JSON-to-GeoJSON-node-and-way",
        "evidence-request-id-and-source",
        "adapter-audit-recorded"
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
