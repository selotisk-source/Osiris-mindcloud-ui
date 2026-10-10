#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { VersionHistory } = require("../mindcloud/version-history");
const { MindCloudRuntime } = require("../mindcloud/runtime");
const { evaluateMetanoia } = require("../mindcloud/metanoia-engine");
const { EvidenceGraph } = require("../mindcloud/evidence-graph");
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), "mindcloud-versions-"));
const storePath = path.join(storeDir, "versions.json");
const unitStorePath = path.join(storeDir, "unit-versions.json");
const taskEventStorePath = path.join(storeDir, "task-events.json");
const evidenceGraphStorePath = path.join(storeDir, "evidence-graph.json");

const port = 39127;
const base = `http://127.0.0.1:${port}`;
const root = path.resolve(__dirname, "..");

function get(url) {
  return fetch(base + url, { headers: { accept: "application/json" } }).then(async (res) => ({
    status: res.status,
    body: await res.json()
  }));
}
function post(url, body={}, token="") {
  const headers={"content-type":"application/json","accept":"application/json"};
  if(token) headers.authorization="Bearer "+token;
  return fetch(base + url, {method:"POST",headers,body:JSON.stringify(body)}).then(async res=>({status:res.status,body:await res.json()}));
}

async function waitForHealth(child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const result = await get("/health");
      if (result.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server did not become healthy");
}

(async () => {
  const mockAdapter = http.createServer((req,res) => {
    res.setHeader("content-type","application/json; charset=utf-8");
    if (req.method === "GET" && req.url === "/health") { res.writeHead(200); res.end(JSON.stringify({status:"healthy",browserEngine:"browserless-chromium",persistentSessions:true})); return; }
    if (req.method === "POST" && req.url === "/v1/run" && req.headers.authorization === "Bearer test-token") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => { const received=JSON.parse(body); res.writeHead(200); res.end(JSON.stringify({status:"executed",httpStatus:200,url:received.input?.url||"https://example.com",title:"Example Domain",ok:true,received})); });
      return;
    }
    res.writeHead(404); res.end(JSON.stringify({error:"not_found"}));
  });
  await new Promise(resolve => mockAdapter.listen(39128,"127.0.0.1",resolve));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), CCTV_SOURCE_URL: "", COGNEE_SERVICE_URL: "", BROWSER_USE_SERVICE_URL: "http://127.0.0.1:39128", BROWSER_USE_API_KEY: "test-token", MINDCLOUD_TOOL_EXECUTION_TOKEN: "mindcloud-test-execution-token", MINDCLOUD_MODEL_VERSION_WRITE_TOKEN: "mindcloud-version-write-test-token", MINDCLOUD_MODEL_VERSION_STORE: storePath, MINDCLOUD_TASK_WRITE_TOKEN: "mindcloud-task-write-test-token", MINDCLOUD_TASK_EVENT_STORE: taskEventStorePath, MINDCLOUD_EVIDENCE_WRITE_TOKEN: "mindcloud-evidence-write-test-token", MINDCLOUD_EVIDENCE_GRAPH_STORE: evidenceGraphStorePath },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHealth(child);

    const metanoiaReport = evaluateMetanoia({
      claims:[
        {subject:"sensor-A",predicate:"status",value:"active",source:"test-a",evidenceRef:"test:source-a"},
        {subject:"sensor-A",predicate:"status",value:"offline",source:"test-b",evidenceRef:"test:source-b"},
        {subject:"sensor-B",predicate:"temperature",value:42,confidence:0.3,evidenceRequired:true}
      ],
      evidenceRefs:["test:source-a","test:source-b"],
      affectedNodeIds:["sensor-A","temperature-model"]
    });
    assert.equal(metanoiaReport.type,"mindcloud_metanoia_report");
    assert.equal(metanoiaReport.status,"review_required");
    assert.equal(metanoiaReport.findings.contradictions.length,1);
    assert.ok(metanoiaReport.alternativeHypotheses.length >= 2);
    assert.ok(metanoiaReport.counterfactualTests.length >= 2);
    assert.deepEqual(metanoiaReport.affectedNodeIds,["sensor-A","temperature-model"]);
    assert.equal(metanoiaReport.proposal.modelMutationPerformed,false);
    assert.equal(metanoiaReport.proposal.versionCreated,false);
    assert.equal(metanoiaReport.proposal.writesPerformed,false);
    assert.equal(metanoiaReport.proposal.humanApprovalRequired,true);
    assert.match(metanoiaReport.reportHash,/^[a-f0-9]{64}$/);
    assert.throws(()=>evaluateMetanoia({claims:[{subject:"broken",predicate:"claim"}]}),/metanoia_claims_invalid/);

    const metanoiaApi = await post("/api/mindcloud/metanoia/evaluate",{
      claims:[
        {subject:"runtime",predicate:"health",value:"ok",source:"source-1"},
        {subject:"runtime",predicate:"health",value:"degraded",source:"source-2"}
      ],
      evidenceRefs:["test:runtime"],
      affectedNodeIds:["runtime-health"]
    });
    assert.equal(metanoiaApi.status,200);
    assert.equal(metanoiaApi.body.status,"review_required");
    assert.equal(metanoiaApi.body.proposal.writesPerformed,false);
    assert.equal(metanoiaApi.body.proposal.humanApprovalRequired,true);

    const emptyEvidenceGraph = await get("/api/mindcloud/evidence-graph");
    assert.equal(emptyEvidenceGraph.status,200);
    assert.equal(emptyEvidenceGraph.body.type,"mindcloud_evidence_graph");
    assert.equal(emptyEvidenceGraph.body.nodeCount,0);
    const blockedEvidenceWrite = await post("/api/mindcloud/evidence-graph/nodes",{type:"claim",label:"blocked",content:{value:true}});
    assert.equal(blockedEvidenceWrite.status,401);
    const claimNode = await post("/api/mindcloud/evidence-graph/nodes",{id:"claim-runtime-health",type:"claim",label:"Runtime health claim",content:{subject:"runtime",predicate:"health",value:"ok"},sourceRef:"test:claim-1"},"mindcloud-evidence-write-test-token");
    assert.equal(claimNode.status,201);
    assert.match(claimNode.body.node.contentHash,/^[a-f0-9]{64}$/);
    const evidenceNode = await post("/api/mindcloud/evidence-graph/nodes",{id:"evidence-runtime-health",type:"evidence",label:"Runtime health test evidence",content:{kind:"test-result",passed:true},sourceRef:"test:runtime-health"},"mindcloud-evidence-write-test-token");
    assert.equal(evidenceNode.status,201);
    const evidenceEdge = await post("/api/mindcloud/evidence-graph/edges",{from:"evidence-runtime-health",to:"claim-runtime-health",relation:"supports"},"mindcloud-evidence-write-test-token");
    assert.equal(evidenceEdge.status,201);
    const invalidEdge = await post("/api/mindcloud/evidence-graph/edges",{from:"missing-node",to:"claim-runtime-health",relation:"supports"},"mindcloud-evidence-write-test-token");
    assert.equal(invalidEdge.status,400);
    const evidenceSnapshot = await get("/api/mindcloud/evidence-graph");
    assert.equal(evidenceSnapshot.body.nodeCount,2);
    assert.equal(evidenceSnapshot.body.edgeCount,1);
    const durableGraph = new EvidenceGraph({storePath:evidenceGraphStorePath});
    assert.equal(durableGraph.snapshot().nodeCount,2);
    assert.equal(durableGraph.snapshot().edgeCount,1);
    assert.throws(()=>durableGraph.addNode({type:"claim",label:"bad",content:{}}),/evidence_node_label_required|evidence_node/);

    const health = await get("/health");
    assert.equal(health.status, 200);
    assert.equal(health.body.status, "ok");

    const taskId = "e2e-test-" + Date.now();
    const unauthenticatedRoute = await post("/api/mindcloud/route",{taskId:"blocked-task",kind:"research",goal:"should be blocked"});
    assert.equal(unauthenticatedRoute.status,401);
    assert.equal(unauthenticatedRoute.body.error,"unauthorized");
    const routed = await post("/api/mindcloud/route",{taskId,kind:"research",goal:"evidence validation"},"mindcloud-task-write-test-token");
    assert.equal(routed.status,200);
    assert.equal(routed.body.status,"routed");
    assert.equal(routed.body.taskId,taskId);
    const taskStatus = await get("/api/mindcloud/status");
    assert.ok(taskStatus.body.tasks.some(task=>task.taskId===taskId));
    const taskEvents = await get("/api/mindcloud/events?taskId="+encodeURIComponent(taskId));
    assert.ok(taskEvents.body.events.some(event=>event.taskId===taskId && event.type==="complete"));

    const durableRuntime = new MindCloudRuntime({storePath:taskEventStorePath});
    const durableTaskId = "durable-task-" + Date.now();
    durableRuntime.route({taskId:durableTaskId,kind:"research",goal:"persist event test"});
    const reopenedRuntime = new MindCloudRuntime({storePath:taskEventStorePath});
    assert.ok(reopenedRuntime.snapshot().tasks.some(task=>task.taskId===durableTaskId));
    assert.ok(reopenedRuntime.eventsFor(durableTaskId).some(event=>event.type==="complete"));
    assert.equal(reopenedRuntime.snapshot().eventCount,durableRuntime.snapshot().eventCount);

    const persistedHistory = new VersionHistory({name:"test-model"},{storePath:unitStorePath});
    const persistedVersion = persistedHistory.create({model:{durable:true},rationale:"Persist for restart test",evidenceRefs:["test:durable"]});
    const reopenedHistory = new VersionHistory({name:"ignored-on-load"},{storePath:unitStorePath});
    assert.equal(reopenedHistory.get(persistedVersion.id).model.durable,true);
    assert.equal(reopenedHistory.get(persistedVersion.id).rationale,"Persist for restart test");
    assert.equal(reopenedHistory.get(persistedVersion.id).modelHash,persistedVersion.modelHash);

    const initialVersions = await get("/api/mindcloud/versions");
    assert.equal(initialVersions.status,200);
    assert.equal(initialVersions.body.type,"mindcloud_model_version_history");
    assert.equal(initialVersions.body.versions.length,1);
    assert.equal(initialVersions.body.versions[0].id,"model-v1");
    assert.match(initialVersions.body.versions[0].modelHash,/^[a-f0-9]{64}$/);

    const unauthenticatedVersionWrite = await post("/api/mindcloud/versions",{model:{state:"blocked"},rationale:"This should not be allowed"});
    assert.equal(unauthenticatedVersionWrite.status,401);
    assert.equal(unauthenticatedVersionWrite.body.error,"unauthorized");

    const versionWithoutRationale = await post("/api/mindcloud/versions",{model:{state:"changed"}},"mindcloud-version-write-test-token");
    assert.equal(versionWithoutRationale.status,400);
    assert.equal(versionWithoutRationale.body.error,"rationale_required_min_8_chars");

    const createdVersion = await post("/api/mindcloud/versions",{
      model:{state:"validated",threshold:0.8},
      rationale:"Raise threshold after validation test",
      changeType:"policy_update",
      evidenceRefs:["test:evidence-001"]
    },"mindcloud-version-write-test-token");
    assert.equal(createdVersion.status,201);
    assert.equal(createdVersion.body.version.id,"model-v2");
    assert.equal(createdVersion.body.version.parentId,"model-v1");
    assert.equal(createdVersion.body.version.rationale,"Raise threshold after validation test");
    assert.deepEqual(createdVersion.body.version.evidenceRefs,["test:evidence-001"]);
    assert.match(createdVersion.body.version.modelHash,/^[a-f0-9]{64}$/);

    const versionReadback = await get("/api/mindcloud/versions/model-v2");
    assert.equal(versionReadback.status,200);
    assert.equal(versionReadback.body.version.model.threshold,0.8);
    const versionsAfterUpdate = await get("/api/mindcloud/versions");
    assert.equal(versionsAfterUpdate.body.versions.length,2);
    assert.ok(versionsAfterUpdate.body.versions.some(version=>version.id==="model-v2" && version.parentId==="model-v1"));
    const versionEvents = await get("/api/mindcloud/events");
    assert.ok(versionEvents.body.events.some(event=>event.type==="model_version_created" && event.data.versionId==="model-v2"));

    const beforeSuggestion = await get("/api/mindcloud/status");
    const suggested = await get("/api/mindcloud/suggest?kind=research&goal=evidence");
    const afterSuggestion = await get("/api/mindcloud/status");
    assert.equal(suggested.status, 200);
    assert.equal(suggested.body.type, "mindcloud_suggestion");
    assert.equal(afterSuggestion.body.tasks.length, beforeSuggestion.body.tasks.length);
    assert.equal(afterSuggestion.body.eventCount, beforeSuggestion.body.eventCount);

    const evidenceValidation = fs.readFileSync(path.join(root, "extension", "evidence-validation.js"), "utf8");
    assert.match(evidenceValidation, /validateCctvEvidence/);

    const router = await get("/api/router?kind=general");
    assert.equal(router.status, 200);
    assert.ok(router.body.network);
    assert.ok(router.body.route);

    const capabilities = await get("/api/capabilities");
    assert.equal(capabilities.status, 200);
    assert.equal(capabilities.body.type, "mindcloud_capability_registry");
    assert.ok(Array.isArray(capabilities.body.capabilities));

    const liveness = await get("/api/liveness/route");
    assert.equal(liveness.status, 200);
    assert.equal(liveness.body.humanApprovalRequired, true);

    const cctv = await get("/api/cctv");
    assert.equal(cctv.status, 200);
    assert.equal(cctv.body.status, "not_configured");
    assert.equal(cctv.body.proxyStatus, "implemented");
    assert.equal(cctv.body.proxyAuthStatus, "credentials-missing");
    assert.equal(cctv.body.streamStatus, "unconfigured");
    assert.equal(cctv.body.frameStatus, "unconfigured");
    assert.equal(cctv.body.evidenceStatus, "unavailable");
    assert.equal(cctv.body.access, "unconfigured");

    const adapters = await get("/api/adapters");
    assert.equal(adapters.status, 200);
    assert.equal(adapters.body.type, "mindcloud_adapter_runtime");
    assert.deepEqual(adapters.body.lifecycle, ["discover","health","execute","result","audit"]);
    assert.ok(adapters.body.adapters.length >= 10);

    const adapter = await get("/api/adapters/browser-use/discover");
    assert.equal(adapter.status, 200);
    assert.equal(adapter.body.ok, true);
    assert.equal(adapter.body.adapter.runtime.state, "configured");
    const adapterHealth = await get("/api/adapters/browser-use/health");
    assert.equal(adapterHealth.status,200);
    assert.equal(adapterHealth.body.status,"healthy");
    assert.equal(adapterHealth.body.browserEngine,"browserless-chromium");
    const unauthenticated = await fetch(base + "/api/adapters/execute", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:"browser-use",operation:"browse",input:{url:"https://example.com"},approved:true})}).then(async res=>({status:res.status,body:await res.json()}));
    assert.equal(unauthenticated.status,401);
    assert.equal(unauthenticated.body.error,"unauthorized");

    const executionHeaders = {"content-type":"application/json","authorization":"Bearer mindcloud-test-execution-token"};
    const adapterRun = await fetch(base + "/api/adapters/execute",{method:"POST",headers:executionHeaders,body:JSON.stringify({id:"browser-use",operation:"browse",input:{url:"https://example.com"},approved:true})}).then(async res=>({status:res.status,body:await res.json()}));
    assert.equal(adapterRun.status,200);
    assert.equal(adapterRun.body.ok,true);
    assert.equal(adapterRun.body.result.received.operation,"browse");

    const blocked = await fetch(base + "/api/adapters/execute", {method:"POST",headers:executionHeaders,body:JSON.stringify({id:"anthropic-cybersecurity-skills",operation:"assess",input:{target:"test"},approved:true})}).then(async res=>({status:res.status,body:await res.json()}));
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.error, "human_approval_required");

    const memory = await get("/api/memory/health");
    assert.equal(memory.status, 200);
    assert.equal(memory.body.status, "not_configured");

    const runtime = await get("/api/runtime/status");
    assert.equal(runtime.status, 200);
    assert.equal(runtime.body.type, "mindcloud_runtime_status");
    assert.equal(runtime.body.health, "degraded");
    assert.equal(runtime.body.coreHealth, "ok");
    assert.ok(runtime.body.cctv);
    assert.ok(runtime.body.memory);

    const selftest = await post("/api/mindcloud/selftest");
    assert.equal(selftest.status,200);
    assert.equal(selftest.body.type,"mindcloud_e2e_selftest");
    assert.equal(selftest.body.core.status,"passed");
    assert.equal(selftest.body.status,"degraded");
    assert.ok(selftest.body.integrations.checks.some(check=>check.id==="cognee-memory-health" && !check.ok));
    assert.ok(selftest.body.integrations.checks.some(check=>check.id==="cognee-memory-persistence" && !check.ok));
    assert.ok(selftest.body.integrations.checks.some(check=>check.id==="browser-use-execution" && check.ok));

    const unknownApi = await get("/api/internal/does-not-exist");
    assert.equal(unknownApi.status,404);
    assert.equal(unknownApi.body.error,"api_route_not_found");

    const sidepanel = fs.readFileSync(path.join(root, "extension", "sidepanel.html"), "utf8");
    const manifest = fs.readFileSync(path.join(root, "extension", "manifest.json"), "utf8");
    assert.match(sidepanel, /Station A · Brave \/ Runtime/);
    assert.match(sidepanel, /Station B · Source \/ Evidence/);
    assert.match(sidepanel, /\/api\/cctv/);
    assert.match(manifest, /"side_panel"/);
    assert.match(manifest, /"host_permissions"/);

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "health",
        "router",
        "task-route-readback-events",
        "task-event-store-persists-across-runtime-restart",
        "task-route-write-requires-dedicated-token",
        "model-version-history-rationale-parent-hash-readback",
        "version-history-disk-persistence-and-reload",
        "model-version-write-api-requires-dedicated-token",
        "capabilities",
        "liveness-approval-gate",
        "cctv-state-reported",
        "memory-unconfigured-reported-as-degraded",
        "runtime-status",
        "adapter-runtime-lifecycle",
        "adapter-discovery",
        "adapter-health-alias",
        "adapter-execution-requires-bearer-token",
        "adapter-execution-roundtrip",
        "client-cannot-forge-human-approval",
        "selftest-core-vs-integration-status",
        "live-browser-execution-probe",
        "unknown-api-returns-404",
        "two-station-sidepanel",
        "brave-host-permission"
      ]
    }, null, 2));
  } catch (error) {
    console.error(stderr);
    console.error(error);
    process.exitCode = 1;
  } finally {
    child.kill("SIGKILL");
    fs.rmSync(storeDir,{recursive:true,force:true});
    mockAdapter.closeAllConnections?.();
    await new Promise(resolve => mockAdapter.close(resolve));
  }
})();
