"use strict";

const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 3,
  maxAgents: 12,
  maxTasks: 24,
  maxTokens: 12000,
  maxTokensPerAgent: 2500
});

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function createAgentCluster(config = {}) {
  const limits = Object.freeze({
    maxDepth: boundedInteger(config.maxDepth, DEFAULT_LIMITS.maxDepth, 1, 5),
    maxAgents: boundedInteger(config.maxAgents, DEFAULT_LIMITS.maxAgents, 1, 32),
    maxTasks: boundedInteger(config.maxTasks, DEFAULT_LIMITS.maxTasks, 1, 64),
    maxTokens: boundedInteger(config.maxTokens, DEFAULT_LIMITS.maxTokens, 256, 100000),
    maxTokensPerAgent: boundedInteger(config.maxTokensPerAgent, DEFAULT_LIMITS.maxTokensPerAgent, 128, 20000)
  });

  function plan({ goal, depth = 2, requestedAgents = 4, tokenBudget, constraints = [] } = {}) {
    const normalizedGoal = cleanText(goal, 2000);
    if (!normalizedGoal) {
      const error = new Error("agent_cluster_goal_required");
      error.code = "agent_cluster_goal_required";
      throw error;
    }

    const maxDepth = Math.min(limits.maxDepth, boundedInteger(depth, 2, 1, limits.maxDepth));
    const agentCount = Math.min(limits.maxAgents, boundedInteger(requestedAgents, 4, 1, limits.maxAgents));
    const totalBudget = Math.min(limits.maxTokens, boundedInteger(tokenBudget, limits.maxTokens, 256, limits.maxTokens));
    const budgetPerAgent = Math.min(limits.maxTokensPerAgent, Math.max(128, Math.floor(totalBudget / agentCount)));
    const taskSpecs = [
      { role: "coordinator", goal: "Decompose the goal into bounded, independently checkable tasks." },
      { role: "researcher", goal: "Collect supporting evidence and clearly label unknowns." },
      { role: "implementer", goal: "Propose the smallest reversible implementation or action." },
      { role: "red-team", goal: "Find contradictions, failure cases, security risks, and unsupported assumptions." },
      { role: "verifier", goal: "Check the proposed result against constraints and observable evidence." },
      { role: "synthesizer", goal: "Combine results, report uncertainty, and identify the next safe step." }
    ].slice(0, Math.min(agentCount, limits.maxTasks));
    const tasks = taskSpecs.map((spec, index) => ({
      id: "agent-task-" + (index + 1),
      agent: spec.role,
      parentTaskId: index === 0 ? null : "agent-task-1",
      depth: index === 0 ? 0 : 1,
      goal: spec.goal,
      input: { goal: normalizedGoal },
      budget: { maxTokens: budgetPerAgent, maxCalls: 1 },
      requiresEvidence: ["researcher", "verifier", "red-team"].includes(spec.role),
      mayExecuteTools: false,
      status: "planned"
    }));
    const normalizedConstraints = Array.isArray(constraints)
      ? constraints.slice(0, 20).map(item => cleanText(item, 300)).filter(Boolean)
      : [];

    return {
      type: "mindcloud_agent_cluster_plan",
      status: "plan_only",
      goal: normalizedGoal,
      limits,
      budget: {
        maxTokens: totalBudget,
        maxTokensPerAgent: budgetPerAgent,
        allocatedTokens: tasks.reduce((sum, task) => sum + task.budget.maxTokens, 0),
        remainingTokens: Math.max(0, totalBudget - tasks.reduce((sum, task) => sum + task.budget.maxTokens, 0)),
        maxModelCalls: tasks.length
      },
      recursion: {
        maxDepth,
        currentDepth: 0,
        stopOnNoProgress: true,
        stopOnBudgetExhaustion: true,
        stopOnRepeatedTask: true,
        noUnboundedRecursivePrompting: true
      },
      constraints: normalizedConstraints,
      tasks,
      gates: {
        toolExecutionEnabled: false,
        externalModelCallsEnabled: false,
        humanApprovalRequiredForSensitiveActions: true,
        evidenceRequiredBeforeVerifiedStatus: true
      },
      createdAt: new Date().toISOString()
    };
  }

  function validateResult(planResult, results = []) {
    if (!planResult || planResult.type !== "mindcloud_agent_cluster_plan") {
      throw new Error("agent_cluster_plan_required");
    }
    const expected = new Set(planResult.tasks.map(task => task.id));
    const seen = new Set();
    const accepted = [];
    const rejected = [];
    for (const result of Array.isArray(results) ? results : []) {
      if (!result || !expected.has(result.taskId) || seen.has(result.taskId)) {
        rejected.push({ taskId: result?.taskId ?? null, reason: "unknown_or_duplicate_task" });
        continue;
      }
      seen.add(result.taskId);
      const outputTokens = boundedInteger(result.outputTokens, 0, 0, planResult.budget.maxTokens + 1);
      const task = planResult.tasks.find(item => item.id === result.taskId);
      if (outputTokens > task.budget.maxTokens) {
        rejected.push({ taskId: result.taskId, reason: "agent_token_budget_exceeded" });
        continue;
      }
      accepted.push({
        taskId: result.taskId,
        status: result.status === "completed" ? "completed" : "needs_review",
        outputTokens,
        evidenceRefs: Array.isArray(result.evidenceRefs) ? result.evidenceRefs.slice(0, 20).map(ref => cleanText(ref, 300)).filter(Boolean) : [],
        summary: cleanText(result.summary, 2000)
      });
    }
    const consumedTokens = accepted.reduce((sum, result) => sum + result.outputTokens, 0);
    return {
      type: "mindcloud_agent_cluster_result_validation",
      accepted,
      rejected,
      budget: planResult.budget,
      consumedTokens,
      remainingTokens: Math.max(0, planResult.budget.maxTokens - consumedTokens),
      complete: accepted.length === planResult.tasks.length && rejected.length === 0 &&
        accepted.every(result => result.status === "completed" && result.evidenceRefs.length > 0),
      promotionAllowed: false,
      note: "Validation does not execute agents or authorize tools; evidence and policy gates remain mandatory."
    };
  }

  return { plan, validateResult, limits };
}

module.exports = { createAgentCluster, DEFAULT_LIMITS };
