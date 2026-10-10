"use strict";
const assert = require("node:assert/strict");
const { createAgentCluster } = require("../mindcore/agent-cluster");

const cluster = createAgentCluster({ maxDepth: 4, maxAgents: 8, maxTasks: 12, maxTokens: 8000, maxTokensPerAgent: 2000 });
assert.throws(() => cluster.plan({ goal: " " }), /agent_cluster_goal_required/);
const plan = cluster.plan({ goal: "Implement a secure OSIRIS command console", depth: 9, requestedAgents: 20, tokenBudget: 100000, constraints: ["Do not merge before CI passes"] });
assert.equal(plan.type, "mindcloud_agent_cluster_plan");
assert.equal(plan.status, "plan_only");
assert.equal(plan.limits.maxDepth, 4);
assert.equal(plan.tasks.length, 8);
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
const incomplete = cluster.validateResult(plan, []);
assert.equal(incomplete.complete, false);
console.log("agent-cluster: verified bounded planning, token allocation, recursion guards, evidence-gated results, duplicate rejection, and no execution authority");
