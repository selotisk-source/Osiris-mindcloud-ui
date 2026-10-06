function createTimeComputeScaling(config = {}) {
  const minBudget = Number.isFinite(config.minBudget) ? Math.max(1, config.minBudget) : 1;
  const maxBudget = Number.isFinite(config.maxBudget) ? Math.max(minBudget, config.maxBudget) : 64;
  const uncertaintyWeight = Number.isFinite(config.uncertaintyWeight) ? config.uncertaintyWeight : 0.6;
  const complexityWeight = Number.isFinite(config.complexityWeight) ? config.complexityWeight : 0.4;

  function allocate({ uncertainty = 0, complexity = 0, budgetHint = 0 } = {}) {
    const u = Math.max(0, Math.min(1, Number(uncertainty)));
    const c = Math.max(0, Math.min(1, Number(complexity)));
    const pressure = u * uncertaintyWeight + c * complexityWeight;
    const hinted = Number(budgetHint) || 0;
    const raw = hinted > 0 ? Math.max(hinted, 1 + pressure * (maxBudget - 1)) : 1 + pressure * (maxBudget - 1);
    const budget = Math.round(Math.max(minBudget, Math.min(maxBudget, raw)));

    return {
      algorithm: "Time-Compute Scaling",
      uncertainty: u,
      complexity: c,
      computePressure: pressure,
      computeBudget: budget,
      allocation: {
        monteCarloSamples: Math.max(1, budget * 16),
        bestOfN: Math.max(1, Math.min(budget, Math.ceil(budget / 4))),
        processVerificationSteps: Math.max(1, Math.ceil(budget / 8)),
        reasoningPasses: Math.max(1, Math.ceil(budget / 16))
      },
      resultType: "compute_allocation"
    };
  }

  return { allocate, config: { minBudget, maxBudget, uncertaintyWeight, complexityWeight } };
}

module.exports = { createTimeComputeScaling };
