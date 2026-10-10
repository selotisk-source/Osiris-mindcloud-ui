#!/usr/bin/env node
// Independent contract grader for the Decision Governor. Keep expected outcomes independent.
const assert = require("node:assert/strict");
const { evaluateDecision } = require("../../mindcloud/decision-governor");

const mandate = {
  automaticActions: ["refresh-status"],
  conditionalActions: ["restart-service"],
  minimumVerifiedEvidence: 1,
  maximumUncertainty: 0.1
};
const evidence = [{ ref: "test://source-a", verified: true }];

function evaluate(action, context = {}, suppliedMandate = mandate) {
  return evaluateDecision({ action, context: { evidence, uncertainty: 0.01, ...context }, mandate: suppliedMandate });
}

try {
  const automatic = evaluate({ type: "refresh-status", risk: "low", reversible: true });
  assert.equal(automatic.route, "AUTO_WITHIN_MANDATE");
  assert.equal(automatic.executionAuthorized, false);
  assert.equal(automatic.executionPerformed, false);
  assert.equal(automatic.mandateTrust, "caller_supplied_not_authenticated");
  assert.equal(automatic.evidenceTrust, "caller_asserted_not_independently_verified");

  const conditional = evaluate(
    { type: "restart-service", risk: "medium", reversible: true, requiredConditions: ["health-check-failed"] },
    { satisfiedConditions: ["health-check-failed"], verificationRequired: true, verificationPassed: true }
  );
  assert.equal(conditional.route, "CONDITIONAL_WITHIN_MANDATE");

  const unmet = evaluate(
    { type: "restart-service", risk: "medium", reversible: true, requiredConditions: ["health-check-failed"] },
    { satisfiedConditions: [] }
  );
  assert.equal(unmet.route, "VERIFY_FIRST");

  const conflict = evaluate({ type: "refresh-status", risk: "low", reversible: true }, { conflicts: ["source-A disagrees with source-B"] });
  assert.equal(conflict.route, "ESCALATE");
  assert.equal(conflict.code, "unresolved_conflicts");

  const highRisk = evaluate({ type: "delete-production-data", risk: "critical", irreversible: true });
  assert.equal(highRisk.route, "ESCALATE");

  const weakEvidence = evaluate({ type: "refresh-status", risk: "low", reversible: true }, { evidence: [{ ref: "test://unverified", verified: false }] });
  assert.equal(weakEvidence.route, "VERIFY_FIRST");

  const missingMandate = evaluate({ type: "refresh-status", risk: "low", reversible: true }, {}, null);
  assert.equal(missingMandate.route, "ESCALATE");
  assert.equal(missingMandate.code, "mandate_missing");

  const outsideMandate = evaluate({ type: "change-access-policy", risk: "medium", reversible: true });
  assert.equal(outsideMandate.route, "ESCALATE");
  assert.equal(outsideMandate.code, "action_outside_mandate");

  assert.throws(() => evaluateDecision({ action: { type: "x", risk: "unknown" }, context: {}, mandate }), /decision_governor_valid_risk_required/);

  console.log(JSON.stringify({
    grader: "decision-governor",
    result: "PASS",
    checks: [
      "explicit-low-risk-mandate",
      "conditional-action-requires-conditions",
      "unmet-conditions-route-to-verification",
      "conflicts-escalate",
      "high-risk-escalates",
      "unverified-evidence-blocks-autonomy",
      "missing-mandate-escalates",
      "out-of-mandate-action-escalates",
      "governor-never-authorizes-or-executes"
    ]
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ grader: "decision-governor", result: "FAIL", reason: error.message }, null, 2));
  process.exitCode = 1;
}
