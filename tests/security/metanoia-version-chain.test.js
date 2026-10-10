#!/usr/bin/env node
// Independent Metanoia contract test. Do not weaken or rewrite expected outcomes to obtain PASS.
// Contract: contradiction analysis is reviewable; after an authenticated human approval,
// previous and proposed model versions plus rationale must be durably saved and readable.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mindcloud-metanoia-contract-"));
const approvalToken = "test-metanoia-approval-token";
let app;
let stderr = "";

async function freePort() {
  const srv = net.createServer();
  await new Promise(resolve => srv.listen(0, "127.0.0.1", resolve));
  const port = srv.address().port;
  await new Promise(resolve => srv.close(resolve));
  return port;
}
async function get(base, route) {
  const response = await fetch(base + route, { headers: { accept: "application/json" } });
  return { status: response.status, body: await response.json() };
}
async function post(base, route, body, token) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const response = await fetch(base + route, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function waitForHealth(base) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    try { if ((await fetch(base + "/health")).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("server_did_not_become_healthy: " + stderr);
}

(async () => {
  const port = await freePort();
  const base = "http://127.0.0.1:" + port;
  const storePath = path.join(temp, "model-versions.json");
  app = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      MINDCLOUD_APPROVAL_TOKEN: approvalToken,
      MINDCLOUD_MODEL_VERSION_STORE: storePath,
      MINDCLOUD_TASK_EVENT_STORE: path.join(temp, "events.json"),
      COGNEE_SERVICE_URL: "",
      BROWSER_USE_SERVICE_URL: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  app.stderr.on("data", chunk => { stderr += chunk; });

  try {
    await waitForHealth(base);
    const before = await get(base, "/api/mindcloud/versions");
    assert.equal(before.status, 200);
    assert.ok(before.body.versions.length >= 1, "baseline model version must exist");
    const previous = before.body.versions[before.body.versions.length - 1];

    const report = await post(base, "/api/mindcloud/metanoia/evaluate", {
      claims: [
        { subject: "sensor-A", predicate: "status", value: "active", source: "test-A", evidenceRef: "test:source-A" },
        { subject: "sensor-A", predicate: "status", value: "offline", source: "test-B", evidenceRef: "test:source-B" }
      ],
      evidenceRefs: ["test:source-A", "test:source-B"],
      affectedNodeIds: ["sensor-A"]
    });
    assert.equal(report.status, 200);
    assert.equal(report.body.status, "review_required");
    assert.equal(report.body.findings.contradictions.length, 1);
    assert.equal(report.body.proposal.humanApprovalRequired, true,
      "Metanoia must preserve the human approval boundary");
    assert.equal(report.body.proposal.modelMutationPerformed, false,
      "analysis must not silently mutate the live model");

    // Required contract: approve the specific contradiction proposal, then persist the proposed version.
    // This endpoint/contract is intentionally tested as a requirement; a missing implementation must FAIL.
    const rationale = "Resolve sensor-A status contradiction after evidence review";
    const approval = await post(base, "/api/mindcloud/metanoia/approve", {
      reportHash: report.body.reportHash,
      expectedPreviousVersionId: previous.id,
      proposedModel: {
        name: "mindcore-model",
        state: { sensorAStatus: "unresolved-review-required" }
      },
      rationale,
      evidenceRefs: ["test:source-A", "test:source-B"]
    }, approvalToken);
    assert.equal(approval.status, 201,
      "METANOIA VERSION CHAIN FAILURE: authenticated approval must create a version transition");
    assert.equal(approval.body.type, "mindcloud_metanoia_version_transition");
    assert.equal(approval.body.previousVersion.id, previous.id);
    assert.ok(approval.body.newVersion.id);
    assert.equal(approval.body.newVersion.parentId, previous.id);
    assert.equal(approval.body.newVersion.rationale, rationale);
    assert.deepEqual(approval.body.newVersion.evidenceRefs, ["test:source-A", "test:source-B"]);

    const after = await get(base, "/api/mindcloud/versions");
    assert.equal(after.status, 200);
    const persistedPrevious = after.body.versions.find(version => version.id === previous.id);
    const persistedNew = after.body.versions.find(version => version.id === approval.body.newVersion.id);
    assert.ok(persistedPrevious, "old version must remain in history");
    assert.ok(persistedNew, "new version must be persisted in history");
    assert.equal(persistedNew.parentId, persistedPrevious.id);
    assert.equal(persistedNew.rationale, rationale);

    console.log(JSON.stringify({
      grader: "metanoia-version-chain",
      result: "PASS",
      checks: ["contradiction-detected", "human-approval-required", "old-version-preserved", "new-version-persisted", "rationale-persisted"]
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      grader: "metanoia-version-chain",
      result: "FAIL",
      reason: error.message,
      note: "A FAIL means the contract is not implemented or the test environment failed; inspect the exact assertion before drawing a conclusion."
    }, null, 2));
    process.exitCode = 1;
  } finally {
    app?.kill("SIGKILL");
    fs.rmSync(temp, { recursive: true, force: true });
  }
})();
