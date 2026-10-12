"use strict";
const assert = require("node:assert/strict");
const { createAgentCluster } = require("../mindcore/agent-cluster");

const cluster = createAgentCluster({ maxDepth: 4, maxAgents: 8, maxTasks: 12, maxTokens: 8000, maxTokensPerAgent: 2000 });
assert.throws(() => cluster.plan({ goal: " " }), /agent_cluster_goal_required/);
const plan = cluster.plan({ goal: "Implement a secure OSIRIS command console", depth: 9, requestedAgents: 20, tokenBudget: 100000, constraints: ["Do not merge before CI passes"] });
assert.equal(plan.type, "mindcloud_agent_cluster_plan");
assert.equal(plan.status, "plan_only");
assert.equal(plan.limits.maxDepth, 4);
assert.equal(plan.tasks.length, 6);
assert.equal(plan.budget.maxTokens, 8000);
assert.ok(plan.budget.allocatedTokens <= plan.budget.maxTokens);
assert.ok(plan.tasks.every(task => task.mayExecuteTools === false));
assert.equal(plan.gates.externalModelCallsEnabled, false);
assert.equal(plan.gates.toolExecutionEnabled, false);
assert.equal(plan.recursion.noUnboundedRecursivePrompting, true);
const valid = cluster.validateResult(plan, [
  { taskId: plan.tasks[0].id, status: "completed", outputTokens: 120, evidenceRefs: ["test://coordinator"], summary: "Split into tasks" },
  { taskId: plan.tasks[1].id, status: "completed", outputTokens: 100, evidenceRefs: ["test://research"], summary: "Evidence captured" },
  { taskId: plan.tasks[1].id, status: "completed", outputTokens: 100, evidenceRefs: ["test://duplicate"], summary: "Duplicate result" },
  { taskId: "unknown", status: "completed", outputTokens: 1, evidenceRefs: ["test://unknown"] }
]);
assert.equal(valid.accepted.length, 2);
assert.equal(valid.rejected.length, 2);
assert.equal(valid.promotionAllowed, false);
const overBudget = cluster.validateResult(plan, [
  { taskId: plan.tasks[0].id, status: "completed", outputTokens: plan.tasks[0].budget.maxTokens + 1, evidenceRefs: ["test://over-budget"] }
]);
assert.equal(overBudget.accepted.length, 0);
assert.equal(overBudget.rejected[0].reason, "agent_token_budget_exceeded");
const malformedTokens = cluster.validateResult(plan, [
  { taskId: plan.tasks[0].id, status: "completed", outputTokens: "not-a-number", evidenceRefs: ["test://malformed"], summary: "Malformed token count must not pass" }
]);
assert.equal(malformedTokens.accepted.length, 0);
assert.equal(malformedTokens.rejected[0].reason, "invalid_output_token_count");

const missingEvidence = cluster.validateResult(plan, [
  { taskId: plan.tasks[0].id, status: "completed", outputTokens: 12, evidenceRefs: [], summary: "No evidence attached" }
]);
assert.equal(missingEvidence.accepted.length, 1);
assert.equal(missingEvidence.accepted[0].status, "needs_review");
assert.equal(missingEvidence.complete, false);
assert.equal(missingEvidence.promotionAllowed, false);

const incomplete = cluster.validateResult(plan, []);
assert.equal(incomplete.complete, false);

const missionContract = {
  mission_id: "mission-agent-cluster-test",
  regent_id: "regent-test",
  authority_scope: ["research"],
  constraints: { risk: "low", noWrites: true },
  formation_id: "formation-research",
  execution_plan_id: "execution-plan-test",
  evidence_required: ["source-url", "verification-result"],
  approval_gate: { required: true },
  status: "proposed",
  version: 1
};
const missionPlan = cluster.planMission({
  missionContract,
  goal: "Research a bounded question",
  requestedAgents: 3,
  constraints: ["read-only"]
});
assert.equal(missionPlan.executionPlanId, "execution-plan-test");
assert.equal(missionPlan.missionHandoff.missionId, missionContract.mission_id);
assert.deepEqual(missionPlan.missionHandoff.authorityScope, ["research"]);
assert.deepEqual(missionPlan.missionHandoff.evidenceRequired, ["source-url", "verification-result"]);
assert.equal(missionPlan.missionHandoff.policyRecheckRequired, true);
assert.equal(missionPlan.missionHandoff.approvalVerificationRequired, true);
assert.equal(missionPlan.missionHandoff.executionAuthorized, false);
assert.equal(missionPlan.gates.serverPolicyRecheckRequired, true);
assert.throws(() => cluster.planMission({
  missionContract: { ...missionContract, authority_scope: "research" },
  goal: "This must fail closed"
}), /agent_cluster_mission_contract_invalid/);
console.log("agent-cluster: verified bounded planning, token allocation, recursion guards, evidence-gated results, duplicate rejection, and no execution authority");
