"use strict";

/**
 * MindCore Mind Cave: a bounded exploration planner.
 * Delegates synthesis and evidence tracing to existing MindCore modules.
 * Hypotheses are not facts; evidence references are not proof.
 */
function invalid(code) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = 400;
  return error;
}
function cleanStrings(value) {
  return Array.isArray(value) ? value.filter(x => typeof x === "string" && x.trim()).map(x => x.trim()) : [];
}
function enterMindCave(input = {}, dependencies = {}) {
  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (!question) throw invalid("mind_cave_question_required");
  const hypotheses = cleanStrings(input.hypotheses);
  const unknowns = cleanStrings(input.unknowns);
  const observations = Array.isArray(input.observations)
    ? input.observations.filter(x => x && typeof x === "object" && !Array.isArray(x)).map(x => ({
      id: typeof x.id === "string" ? x.id : null,
      source: typeof x.source === "string" ? x.source : "unspecified",
      observation: typeof x.observation === "string" ? x.observation.trim() : "",
      interpretation: typeof x.interpretation === "string" ? x.interpretation.trim() : "",
      limitations: cleanStrings(x.limitations),
      status: typeof x.status === "string" ? x.status : "unassessed"
    })) : [];
  let joint = null;
  if (input.partials !== undefined) {
    if (!input.partials || !input.partials.left || !input.partials.right || typeof dependencies.createJoint !== "function") {
      throw invalid("mind_cave_joint_dependencies_required");
    }
    joint = dependencies.createJoint({left: input.partials.left, right: input.partials.right});
  }
  let trace = null;
  if (input.graph !== undefined || input.traceRootId !== undefined) {
    if (!input.graph || typeof input.traceRootId !== "string" || !input.traceRootId.trim() || typeof dependencies.recursiveTrace !== "function") {
      throw invalid("mind_cave_trace_dependencies_required");
    }
    trace = dependencies.recursiveTrace(input.graph, {
      rootId: input.traceRootId.trim(),
      direction: input.traceDirection || "both",
      maxDepth: input.maxDepth,
      maxNodes: input.maxNodes
    });
  }
  const nextQuestions = [
    "Vilka observationer stöder respektive hypotes?",
    "Vilka alternativa förklaringar passar samma observationer?",
    "Vilka källor är oberoende, och vilka kan dela ursprung?",
    "Vilken information skulle kunna motbevisa varje hypotes?"
  ];
  if (observations.some(x => x.limitations.length)) nextQuestions.push("Hur påverkar källornas begränsningar slutsatserna?");
  if (unknowns.length) nextQuestions.push("Vilka okända faktorer blockerar en välgrundad slutsats?");
  return {
    type: "mindcore_mind_cave",
    status: joint && joint.status === "needs_reconciliation" ? "needs_reconciliation" : "exploration_plan",
    question, hypotheses, observations, unknowns, joint, trace,
    guardrails: {
      observationIsNotInterpretation: true,
      sourceReferenceIsNotProof: true,
      sharedSourceIsNotIndependentConfirmation: true,
      unresolvedConflictsRemainVisible: true,
      missingDataMeansUnknownNotFalse: true
    },
    nextQuestions,
    independentlyValidated: false
  };
}
module.exports = {enterMindCave};
