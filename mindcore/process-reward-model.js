function createProcessRewardModel(config = {}) {
  const stepWeights = Array.isArray(config.stepWeights) ? config.stepWeights : [];

  function scoreStep(step = {}, index = 0) {
    const correctness = Number(step.correctness ?? 0);
    const relevance = Number(step.relevance ?? 0);
    const evidence = Number(step.evidence ?? 0);
    const safety = Number(step.safety ?? 0);
    const weight = Number(stepWeights[index] ?? 1);
    const score = ((correctness + relevance + evidence + safety) / 4) * weight;
    return { index, score, correctness, relevance, evidence, safety, weight };
  }

  function evaluate(steps = []) {
    const scored = steps.map(scoreStep);
    const totalWeight = scored.reduce((s, x) => s + x.weight, 0) || 1;
    const processScore = scored.reduce((s, x) => s + x.score, 0) / totalWeight;
    return {
      algorithm: "Process Reward Model",
      stepCount: scored.length,
      processScore,
      steps: scored,
      resultType: "process_evaluation"
    };
  }

  return { scoreStep, evaluate };
}

module.exports = { createProcessRewardModel };
