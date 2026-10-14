"use strict";
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

let port;
let base = "";
const token = "mindcloud-mission-plan-test-token";

async function waitHealthy(child) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("MindCloud server exited before becoming healthy");
    if (base) {
      try {
        const response = await fetch(base + "/health");
        if (response.ok) return;
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("MindCloud server did not become healthy at " + (base || "an assigned port"));
}

async function request(path, body, authorized = true, bearer = token, regentToken = "mindcloud-regent-test-token") {
  const headers = { "content-type": "application/json" };
  if (authorized) headers.authorization = "Bearer " + bearer;
  if (regentToken) headers["x-mindcloud-regent-token"] = regentToken;
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
      PORT: "0",
      CCTV_SOURCE_URL: "",
      COGNEE_SERVICE_URL: "",
      MINDCLOUD_TOOL_EXECUTION_TOKEN: token,
      MINDCLOUD_REGENT_ID: "regent-test",
      MINDCLOUD_REGENT_TOKEN: "mindcloud-regent-test-token",
      MINDCLOUD_APPROVAL_TOKEN: "mindcloud-mission-approval-test-token",
      MINDCLOUD_EVIDENCE_READ_TOKEN: "mindcloud-mission-evidence-read-token",
      MINDCLOUD_EVIDENCE_WRITE_TOKEN: "mindcloud-mission-evidence-write-token",
      MINDCLOUD_EVIDENCE_GRAPH_STORE: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  let startupOutput = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.stdout.on("data", chunk => {
    startupOutput += chunk.toString();
    const match = startupOutput.match(/OSIRIS MindCloud listening on port (\d+)/);
    if (match && !base) {
      port = Number(match[1]);
      base = `http://127.0.0.1:${port}`;
    }
  });

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
    const wrongRegent = await request("/api/mindcloud/agent-cluster/mission-plan", {
      missionContract,
      goal: "Wrong Regent identity must fail closed"
    }, true, token, "wrong-regent-token");
    assert.equal(wrongRegent.status, 401);
    assert.equal(wrongRegent.body.error, "regent_identity_not_authorized");

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

    const executableMission = {
      ...missionContract,
      mission_id: "mission-execution-route-test",
      authority_scope: ["mapillary:health"],
      execution_plan_id: "plan-execution-route-test",
      status: "proposed",
      approval_gate: { required: true },
      evidence_required: ["approval-record", "execution-result"]
    };
    const executionPlan = await request("/api/mindcloud/agent-cluster/mission-plan", {
      missionContract: executableMission,
      goal: "Exercise the server-owned mission execution gate",
      requestedAgents: 2
    });
    assert.equal(executionPlan.status, 200, JSON.stringify(executionPlan.body));
    const missionId = executionPlan.body.mission.missionId;
    assert.equal(missionId, executableMission.mission_id);
    assert.equal(executionPlan.body.mission.status, "registered");

    const unauthenticatedExecution = await request("/api/mindcloud/agent-cluster/mission-execute", {
      id: "mapillary",
      operation: "health",
      input: {},
      missionId
    }, false);
    assert.equal(unauthenticatedExecution.status, 401);

    const noApproval = await request("/api/mindcloud/agent-cluster/mission-execute", {
      id: "mapillary",
      operation: "health",
      input: {},
      missionId
    });
    assert.equal(noApproval.status, 403);
    assert.equal(noApproval.body.error, "mission_server_approval_required");

    const approvalRequest = await request("/api/approvals/request", {
      id: "mapillary",
      operation: "health",
      input: {}
    });
    assert.equal(approvalRequest.status, 201, JSON.stringify(approvalRequest.body));
    const approvalId = approvalRequest.body.request.id;
    const approvalDecision = await request(
      `/api/approvals/${approvalId}/decision`,
      { decision: "approved", reason: "Automated mission gate regression test" },
      true,
      "mindcloud-mission-approval-test-token"
    );
    assert.equal(approvalDecision.status, 200, JSON.stringify(approvalDecision.body));
    assert.equal(approvalDecision.body.request.status, "approved");

    const scopeMismatch = await request("/api/mindcloud/agent-cluster/mission-execute", {
      id: "mapillary",
      operation: "search",
      input: { query: "test" },
      missionId,
      approvalId
    });
    assert.equal(scopeMismatch.status, 403);
    assert.equal(scopeMismatch.body.error, "mission_scope_mismatch");

    const executedMission = await request("/api/mindcloud/agent-cluster/mission-execute", {
      id: "mapillary",
      operation: "health",
      input: {},
      missionId,
      approvalId
    });
    assert.equal(executedMission.status, 200, JSON.stringify(executedMission.body));
    assert.equal(executedMission.body.missionGate.status, "server-approved-for-single-action");
    assert.equal(executedMission.body.missionGate.missionId, missionId);
    assert.equal(executedMission.body.missionGate.approvalVerifiedByServer, true);
    assert.equal(executedMission.body.missionGate.toolExecutionEnabledByMissionGate, true);
    assert.equal(executedMission.body.missionGate.completionPromotionAllowed, false);
    assert.equal(executedMission.body.missionGate.missionStatus, "needs_review");

    const replay = await request("/api/mindcloud/agent-cluster/mission-execute", {
      id: "mapillary",
      operation: "health",
      input: {},
      missionId,
      approvalId
    });
    assert.equal(replay.status, 409);
    assert.equal(replay.body.error, "mission_not_executable");
    assert.equal(replay.body.missionStatus, "needs_review");

    console.log("agent-cluster mission route: PASS (Regent identity binding, server registry, exact scope, single-use approval, replay denial, evidence review gate)");
  } catch (error) {
    console.error(error);
    if (stderr) console.error(stderr);
    process.exitCode = 1;
  } finally {
    child.kill("SIGTERM");
  }
})();
