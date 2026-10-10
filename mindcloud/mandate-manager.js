const crypto = require("node:crypto");
const { evaluateDecision } = require("./decision-governor");

const ACTION_CATALOG = Object.freeze({
  "refresh-status": Object.freeze({ risk: "low", reversible: true, category: "read-only", description: "Read MindCloud status." }),
  "health-check": Object.freeze({ risk: "low", reversible: true, category: "read-only", description: "Read service health and readiness." }),
  "discover-adapter": Object.freeze({ risk: "low", reversible: true, category: "read-only", description: "Discover adapter capabilities without executing a tool." }),
  "read-evidence-graph": Object.freeze({ risk: "low", reversible: true, category: "read-only", description: "Read the evidence graph snapshot." })
});

const BASELINE_POLICY = Object.freeze({
  policyId: "mindcloud-baseline-readonly",
  version: "1.0.0",
  status: "active",
  scope: "global",
  automaticActions: Object.freeze(Object.keys(ACTION_CATALOG)),
  conditionalActions: Object.freeze([]),
  minimumVerifiedEvidence: 0,
  maximumUncertainty: 0.15,
  humanApprovalTriggers: Object.freeze([
    "high-or-critical-risk",
    "irreversible-action",
    "unresolved-contradictions",
    "action-outside-explicit-mandate",
    "uncertainty-above-policy-limit",
    "unknown-scope",
    "unverified-policy-change"
  ]),
  executionEnabled: false
});

function clonePolicy(policy = BASELINE_POLICY) {
  return {
    policyId: policy.policyId,
    version: policy.version,
    status: policy.status,
    scope: policy.scope,
    automaticActions: [...policy.automaticActions],
    conditionalActions: [...policy.conditionalActions],
    minimumVerifiedEvidence: policy.minimumVerifiedEvidence,
    maximumUncertainty: policy.maximumUncertainty,
    humanApprovalTriggers: [...policy.humanApprovalTriggers],
    executionEnabled: false
  };
}

function listMandates() {
  return {
    type: "mindcloud_mandate_catalog",
    policyManagement: "server-defined-read-only",
    policies: [clonePolicy()],
    actionCatalog: Object.entries(ACTION_CATALOG).map(([type, definition]) => ({ type, ...definition })),
    writesEnabled: false,
    executionEnabled: false
  };
}

function evaluateMandate(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("mandate_manager_input_object_required");
    error.statusCode = 400;
    throw error;
  }
  const actionType = typeof input.action?.type === "string" ? input.action.type.trim() : "";
  const scope = input.scope === undefined ? "global" : input.scope;
  if (typeof scope !== "string" || !scope.trim()) {
    const error = new Error("mandate_manager_scope_invalid");
    error.statusCode = 400;
    throw error;
  }
  const actionDefinition = ACTION_CATALOG[actionType];
  if (scope !== "global") {
    return blocked("ESCALATE", "unknown_scope", "No server-defined mandate exists for the requested scope.", actionType, scope);
  }
  if (!actionDefinition) {
    return blocked("ESCALATE", "action_outside_mandate", "No explicit server-defined mandate permits this action.", actionType || null, scope);
  }
  const context = input.context === undefined ? {} : input.context;
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    const error = new Error("mandate_manager_context_object_required");
    error.statusCode = 400;
    throw error;
  }
  const decision = evaluateDecision({
    action: { type: actionType, risk: actionDefinition.risk, reversible: actionDefinition.reversible, requiredConditions: [] },
    context: {
      conflicts: context.conflicts === undefined ? [] : context.conflicts,
      evidence: [],
      uncertainty: context.uncertainty === undefined ? 1 : context.uncertainty,
      verificationRequired: context.verificationRequired === true,
      verificationPassed: context.verificationPassed === true,
      criticalImpact: context.criticalImpact === true,
      satisfiedConditions: []
    },
    mandate: {
      automaticActions: [...BASELINE_POLICY.automaticActions],
      conditionalActions: [],
      minimumVerifiedEvidence: 0,
      maximumUncertainty: BASELINE_POLICY.maximumUncertainty
    }
  });
  return {
    ...decision,
    type: "mindcloud_mandate_decision",
    decisionId: "mdc-" + crypto.randomUUID(),
    policy: { policyId: BASELINE_POLICY.policyId, version: BASELINE_POLICY.version, scope: BASELINE_POLICY.scope },
    action: { type: actionType, ...actionDefinition },
    scope,
    contextTrust: "request-supplied-advisory-only",
    evidenceTrust: "no-independent-evidence-verifier-configured",
    executionAuthorized: false,
    executionPerformed: false,
    policyMutationPerformed: false
  };
}

function blocked(route, code, reason, actionType, scope) {
  return {
    type: "mindcloud_mandate_decision",
    decisionId: "mdc-" + crypto.randomUUID(),
    protocolVersion: "1.0.0",
    route,
    code,
    reasons: [reason],
    policy: { policyId: BASELINE_POLICY.policyId, version: BASELINE_POLICY.version, scope: BASELINE_POLICY.scope },
    action: actionType ? { type: actionType } : null,
    scope,
    contextTrust: "request-supplied-advisory-only",
    evidenceTrust: "no-independent-evidence-verifier-configured",
    executionAuthorized: false,
    executionPerformed: false,
    policyMutationPerformed: false
  };
}

module.exports = { ACTION_CATALOG, BASELINE_POLICY, listMandates, evaluateMandate };
