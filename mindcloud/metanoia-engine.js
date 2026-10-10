const crypto = require("node:crypto");

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function evaluateMetanoia(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    const error = new Error("metanoia_input_object_required");
    error.statusCode = 400;
    throw error;
  }
  const claims = input.claims === undefined ? [] : input.claims;
  const evidenceRefs = input.evidenceRefs === undefined ? [] : input.evidenceRefs;
  const affectedNodeIds = input.affectedNodeIds === undefined ? [] : input.affectedNodeIds;
  if (!Array.isArray(claims) || claims.some(claim =>
    !claim || typeof claim !== "object" ||
    typeof claim.subject !== "string" || !claim.subject.trim() ||
    typeof claim.predicate !== "string" || !claim.predicate.trim() ||
    !Object.prototype.hasOwnProperty.call(claim, "value")
  )) {
    const error = new Error("metanoia_claims_invalid");
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(evidenceRefs) || evidenceRefs.some(ref => typeof ref !== "string" || !ref.trim())) {
    const error = new Error("metanoia_evidence_refs_invalid");
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(affectedNodeIds) || affectedNodeIds.some(id => typeof id !== "string" || !id.trim())) {
    const error = new Error("metanoia_affected_node_ids_invalid");
    error.statusCode = 400;
    throw error;
  }

  const contradictions = [];
  const seen = new Map();
  for (const claim of claims) {
    const key = JSON.stringify([claim.subject.trim(), claim.predicate.trim()]);
    const prior = seen.get(key) || [];
    for (const existing of prior) {
      if (JSON.stringify(existing.value) !== JSON.stringify(claim.value)) {
        contradictions.push({
          subject: claim.subject.trim(),
          predicate: claim.predicate.trim(),
          claimA: { value: existing.value, source: existing.source || null },
          claimB: { value: claim.value, source: claim.source || null },
          evidenceRefs: [...new Set([existing.evidenceRef, claim.evidenceRef].filter(ref => typeof ref === "string" && ref.trim()))]
        });
      }
    }
    prior.push(claim);
    seen.set(key, prior);
  }

  const anomalies = [];
  claims.forEach((claim, index) => {
    if (typeof claim.confidence === "number" && (claim.confidence < 0 || claim.confidence > 1)) {
      anomalies.push({ type: "confidence_out_of_range", claimIndex: index, confidence: claim.confidence });
    } else if (typeof claim.confidence === "number" && claim.confidence < 0.5) {
      anomalies.push({ type: "low_confidence_claim", claimIndex: index, confidence: claim.confidence });
    }
    if (claim.evidenceRequired === true && !(typeof claim.evidenceRef === "string" && claim.evidenceRef.trim())) {
      anomalies.push({ type: "missing_claim_evidence", claimIndex: index });
    }
  });

  const alternativeHypotheses = contradictions.map((item, index) => ({
    id: "hypothesis-" + (index + 1),
    statement: "At least one claim about " + item.subject + "." + item.predicate + " is incorrect, outdated, or scoped differently.",
    discriminatingEvidence: item.evidenceRefs,
    confidence: "unassessed"
  }));
  if (anomalies.length) {
    alternativeHypotheses.push({
      id: "hypothesis-" + (alternativeHypotheses.length + 1),
      statement: "Some inputs may be incomplete or insufficiently supported.",
      discriminatingEvidence: [...new Set(evidenceRefs)],
      confidence: "unassessed"
    });
  }

  const counterfactualTests = contradictions.map((item, index) => ({
    id: "counterfactual-" + (index + 1),
    question: "If the claim value were " + JSON.stringify(item.claimA.value) + " rather than " + JSON.stringify(item.claimB.value) + ", which dependent conclusions would change?",
    subject: item.subject,
    predicate: item.predicate,
    requiresEvidenceReview: true
  }));
  const anomalyTests = anomalies.map((item, index) => ({
    id: "anomaly-check-" + (index + 1),
    question: "Can the flagged input be corroborated, corrected, or explicitly marked unknown?",
    anomalyType: item.type,
    requiresEvidenceReview: true
  }));

  const report = {
    type: "mindcloud_metanoia_report",
    engineVersion: "1.0.0",
    status: contradictions.length || anomalies.length ? "review_required" : "no_issue_detected",
    generatedAt: new Date().toISOString(),
    inputHash: stableHash({ claims, evidenceRefs, affectedNodeIds }),
    findings: { contradictions, anomalies },
    alternativeHypotheses,
    counterfactualTests: [...counterfactualTests, ...anomalyTests],
    affectedNodeIds: [...new Set(affectedNodeIds)],
    evidenceRefs: [...new Set(evidenceRefs)],
    proposal: {
      action: contradictions.length || anomalies.length ? "propose_targeted_revalidation" : "no_change",
      modelMutationPerformed: false,
      versionCreated: false,
      writesPerformed: false,
      humanApprovalRequired: true,
      rationale: "Metanoia produces a reviewable proposal only; it does not change the model or evidence graph."
    }
  };
  report.reportHash = stableHash(report);
  return report;
}

module.exports = { evaluateMetanoia };
