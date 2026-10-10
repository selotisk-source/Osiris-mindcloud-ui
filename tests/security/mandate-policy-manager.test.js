#!/usr/bin/env node
// Independent mandate-policy contract grader. This manager only classifies; it never executes or mutates policy.
const assert = require("node:assert/strict");
const { listMandates, evaluateMandate } = require("../../mindcloud/mandate-manager");

try {
  const catalog = listMandates();
  assert.equal(catalog.type, "mindcloud_mandate_catalog");
  assert.equal(catalog.policyManagement, "server-defined-read-only");
  assert.equal(catalog.executionEnabled, false);
  assert.equal(catalog.writesEnabled, false);
  assert.ok(catalog.policies[0].automaticActions.includes("health-check"));
  assert.deepEqual(catalog.policies[0].conditionalActions, []);

  const readOnly = evaluateMandate({ action: { type: "health-check" }, context: { uncertainty: 0.01 } });
  assert.equal(readOnly.route, "AUTO_WITHIN_MANDATE");
  assert.equal(readOnly.action.risk, "low");
  assert.equal(readOnly.action.reversible, true);
  assert.equal(readOnly.executionAuthorized, false);
  assert.equal(readOnly.executionPerformed, false);
  assert.equal(readOnly.policyMutationPerformed, false);
  assert.equal(readOnly.contextTrust, "request-supplied-advisory-only");
  assert.equal(readOnly.evidenceTrust, "no-independent-evidence-verifier-configured");

  const noAssessment = evaluateMandate({ action: { type: "health-check" } });
  assert.equal(noAssessment.route, "ESCALATE");
  assert.equal(noAssessment.code, "uncertainty_above_mandate");

  const highImpact = evaluateMandate({ action: { type: "refresh-status" }, context: { uncertainty: 0.01, criticalImpact: true } });
  assert.equal(highImpact.route, "ESCALATE");
  assert.equal(highImpact.code, "critical_or_irreversible_impact");

  const contradiction = evaluateMandate({ action: { type: "health-check" }, context: { uncertainty: 0.01, conflicts: ["source A contradicts source B"] } });
  assert.equal(contradiction.route, "ESCALATE");
  assert.equal(contradiction.code, "unresolved_conflicts");

  const outside = evaluateMandate({ action: { type: "restart-service", risk: "low" }, context: { uncertainty: 0 } });
  assert.equal(outside.route, "ESCALATE");
  assert.equal(outside.code, "action_outside_mandate");

  const unknownScope = evaluateMandate({ scope: "site:unknown", action: { type: "health-check" } });
  assert.equal(unknownScope.route, "ESCALATE");
  assert.equal(unknownScope.code, "unknown_scope");

  assert.throws(() => evaluateMandate({ action: { type: "health-check" }, context: [] }), /mandate_manager_context_object_required/);

  console.log(JSON.stringify({
    grader: "mandate-policy-manager",
    result: "PASS",
    checks: [
      "server-defined-read-only-policy-catalog",
      "only-explicit-read-only-actions-are-in-mandate",
      "caller-cannot-override-action-risk",
      "missing-assessment-escalates",
      "critical-impact-escalates",
      "contradictions-escalate",
      "unknown-actions-escalate",
      "unknown-scopes-escalate",
      "manager-never-authorizes-execution-or-policy-writes"
    ]
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ grader: "mandate-policy-manager", result: "FAIL", reason: error.message }, null, 2));
  process.exitCode = 1;
}
