function createReasoningOrchestrator(config = {}) {
  const maxSteps = Number.isInteger(config.maxSteps) ? Math.max(1, config.maxSteps) : 8;

  function plan({ question, context = {}, constraints = [] }) {
    return {
      type: "reasoning_plan",
      question,
      context,
      constraints,
      steps: [
        "decompose",
        "generate_hypotheses",
        "evaluate_evidence",
        "test_constraints",
        "synthesize",
        "verify"
      ].slice(0, maxSteps)
    };
  }

  function evaluate({ hypotheses = [], evidence = [], constraints = [] }) {
    const checks = hypotheses.map((hypothesis, index) => ({
      id: index + 1,
      hypothesis,
      evidenceCount: evidence.filter(e => e?.hypothesis === hypothesis).length,
      constraintChecks: constraints.map(c => ({ constraint: c, checked: true }))
    }));
    return {
      type: "reasoning_evaluation",
      checks,
      evidenceCount: evidence.length,
      constraintCount: constraints.length
    };
  }

  function synthesize({ conclusion, confidence = 0, evidence = [] }) {
    return {
      type: "reasoning_result",
      conclusion,
      confidence: Math.max(0, Math.min(1, Number(confidence))),
      evidenceCount: evidence.length,
      verified: Number(confidence) >= 0.7 && evidence.length > 0
    };
  }

  return { plan, evaluate, synthesize };
}

module.exports = { createReasoningOrchestrator };
