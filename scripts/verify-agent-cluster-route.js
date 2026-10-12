"use strict";
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const port = 39147;
const base = `http://127.0.0.1:${port}`;
const token = "mindcloud-mission-plan-test-token";

async function waitHealthy(child) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base + "/health");
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("MindCloud server did not become healthy");
}

async function request(path, body, authorized = true) {
  const headers = { "content-type": "application/json" };
  if (authorized) headers.authorization = "Bearer " + token;
  const response = await fetch(base + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

(async () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      CCTV_SOURCE_URL: "",
      COGNEE_SERVICE_URL: "",
      MINDCLOUD_TOOL_EXECUTION_TOKEN: token,
      MINDCLOUD_APPROVAL_TOKEN: "mindcloud-mission-approval-test-token",
      MINDCLOUD_EVIDENCE_READ_TOKEN: "mindcloud-mission-evidence-read-token",
      MINDCLOUD_EVIDENCE_WRITE_TOKEN: "mindcloud-mission-evidence-write-token",
      MINDCLOUD_EVIDENCE_GRAPH_STORE: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });

  try {
    await waitHealthy(child);

    const denied = await request("/api/mindcloud/agent-cluster/mission-plan", {}, false);
    assert.equal(denied.status, 401, "mission planning must require the execution-token boundary");

    const missionContract = {
      mission_id: "mission-route-test",
      regent_id: "regent-test",
      authority_scope: ["research"],
      constraints: { risk: "low", noWrites: true },
      formation_id: "formation-research",
      execution_plan_id: "plan-route-test",
      evidence_required: ["source-url"],
      approval_gate: { required: true },
      status: "proposed",
      version: 1
    };
    const planned = await request("/api/mindcloud/agent-cluster/mission-plan", {
      missionContract,
      goal: "Validate mission contract propagation",
      requestedAgents: 2,
      planningConstraints: ["read-only"]
    });
    assert.equal(planned.status, 200, JSON.stringify(planned.body));
    assert.equal(planned.body.type, "mindcloud_agent_cluster_plan");
    assert.equal(planned.body.executionPlanId, "plan-route-test");
    assert.equal(planned.body.missionHandoff.missionId, "mission-route-test");
    assert.deepEqual(planned.body.missionHandoff.authorityScope, ["research"]);
    assert.deepEqual(planned.body.missionHandoff.evidenceRequired, ["source-url"]);
    assert.equal(planned.body.missionHandoff.policyRecheckRequired, true);
    assert.equal(planned.body.missionHandoff.approvalVerificationRequired, true);
    assert.equal(planned.body.missionHandoff.executionAuthorized, false);
    assert.equal(planned.body.gates.toolExecutionEnabled, false);
    assert.equal(planned.body.gates.serverPolicyRecheckRequired, true);

    const malformed = await request("/api/mindcloud/agent-cluster/mission-plan", {
      missionContract: { ...missionContract, authority_scope: "research" },
      goal: "This must fail closed"
    });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error, "agent_cluster_mission_contract_invalid");
    assert.ok(Array.isArray(malformed.body.details));

    console.log("agent-cluster mission route: PASS (auth, contract propagation, fail-closed validation, no execution authority)");
  } catch (error) {
    console.error(error);
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    child.kill("SIGTERM");
  }
})();
