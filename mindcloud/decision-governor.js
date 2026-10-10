const ALLOWED_RISK = new Set(["low", "medium", "high", "critical"]);
const RISK_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function evaluateDecision(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw invalid("decision_governor_input_object_required");
  }
  const action = input.action;
  const context = input.context || {};
  const mandate = input.mandate;
  if (!action || typeof action !== "object" || Array.isArray(action) ||
      typeof action.type !== "string" || !action.type.trim()) {
    throw invalid("decision_governor_action_type_required");
  }
  if (!ALLOWED_RISK.has(action.risk)) throw invalid("decision_governor_valid_risk_required");
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw invalid("decision_governor_context_object_required");
  }
  if (!mandate || typeof mandate !== "object" || Array.isArray(mandate)) {
    return result("ESCALATE", "mandate_missing", ["No trusted mandate was supplied."], input);
  }
  if (!Array.isArray(mandate.automaticActions) || !Array.isArray(mandate.conditionalActions)) {
    throw invalid("decision_governor_mandate_action_lists_required");
  }
  const conflicts = context.conflicts === undefined ? [] : context.conflicts;
  const evidence = context.evidence === undefined ? [] : context.evidence;
  if (!Array.isArray(conflicts) || conflicts.some(x => typeof x !== "string")) {
    throw invalid("decision_governor_conflicts_invalid");
  }
  if (!Array.isArray(evidence) || evidence.some(x => !x || typeof x !== "object" || typeof x.verified !== "boolean")) {
    throw invalid("decision_governor_evidence_invalid");
  }
  const uncertainty = context.uncertainty === undefined ? 1 : context.uncertainty;
  if (typeof uncertainty !== "number" || !Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 1) {
    throw invalid("decision_governor_uncertainty_invalid");
  }
  const reasons = [];
  if (action.risk === "high" || action.risk === "critical") {
    return result("ESCALATE", "high_consequence_action", ["High- or critical-risk actions require human review."], input);
  }
  if (conflicts.length) {
    return result("ESCALATE", "unresolved_conflicts", ["Unresolved conflicts block autonomous decisions.", ...conflicts], input);
  }
  if (context.criticalImpact === true || action.irreversible === true) {
    return result("ESCALATE", "critical_or_irreversible_impact", ["Critical-impact or irreversible actions require human review."], input);
  }
  if (context.verificationRequired === true && context.verificationPassed !== true) {
    return result("VERIFY_FIRST", "verification_required", ["Required verification has not passed."], input);
  }
  const minEvidence = Number.isInteger(mandate.minimumVerifiedEvidence) && mandate.minimumVerifiedEvidence >= 0
    ? mandate.minimumVerifiedEvidence : 1;
  const verifiedCount = evidence.filter(item => item.verified === true && typeof item.ref === "string" && item.ref.trim()).length;
  if (verifiedCount < minEvidence) {
    return result("VERIFY_FIRST", "insufficient_verified_evidence", ["The mandate's verified-evidence requirement is not met."], input);
  }
  const maxUncertainty = typeof mandate.maximumUncertainty === "number" &&
    Number.isFinite(mandate.maximumUncertainty) && mandate.maximumUncertainty >= 0 && mandate.maximumUncertainty <= 1
    ? mandate.maximumUncertainty : 0.15;
  if (uncertainty > maxUncertainty) {
    return result("ESCALATE", "uncertainty_above_mandate", ["Uncertainty exceeds the mandate's limit."], input);
  }
  if (mandate.automaticActions.includes(action.type) && action.risk === "low" && action.reversible === true) {
    return result("AUTO_WITHIN_MANDATE", "automatic_mandate_matches", ["Action matches an explicit low-risk, reversible mandate."], input);
  }
  if (mandate.conditionalActions.includes(action.type)) {
    const requiredConditions = action.requiredConditions === undefined ? [] : action.requiredConditions;
    if (!Array.isArray(requiredConditions) || requiredConditions.some(x => typeof x !== "string" || !x.trim())) {
      throw invalid("decision_governor_required_conditions_invalid");
    }
    const satisfied = context.satisfiedConditions === undefined ? [] : context.satisfiedConditions;
    if (!Array.isArray(satisfied) || satisfied.some(x => typeof x !== "string")) {
      throw invalid("decision_governor_satisfied_conditions_invalid");
    }
    const missing = requiredConditions.filter(condition => !satisfied.includes(condition));
    if (missing.length) {
      return result("VERIFY_FIRST", "conditional_requirements_unmet", ["Required conditions are not satisfied.", ...missing], input);
    }
    return result("CONDITIONAL_WITHIN_MANDATE", "conditional_mandate_matches", ["All declared conditions are satisfied; downstream policy enforcement is still required."], input);
  }
  return result("ESCALATE", "action_outside_mandate", ["No explicit mandate permits this action."], input);
}

function result(route, code, reasons, input) {
  return {
    type: "mindcloud_decision_governor_report",
    protocolVersion: "0.1.0",
    route,
    code,
    reasons,
    actionType: input?.action?.type || null,
    executionAuthorized: false,
    executionPerformed: false,
    note: "This report routes a decision only. A separate trusted policy and execution gate must authorize any real-world action."
  };
}

module.exports = { evaluateDecision };
