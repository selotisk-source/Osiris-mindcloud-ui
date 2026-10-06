const EPSILON = 1e-8;

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map(v => (v - m) ** 2)));
}

function relativeAdvantages(rewards) {
  const m = mean(rewards);
  const sd = standardDeviation(rewards);
  return rewards.map(reward => (reward - m) / (sd + EPSILON));
}

/**
 * Group Relative Policy Optimization.
 *
 * This module deliberately owns the optimization math, not model execution.
 * A caller supplies grouped rollout rewards and policy ratios; the returned
 * metrics/gradients can then be consumed by the model/runtime adapter.
 */
function createGRPO(config = {}) {
  const clipRange = Number.isFinite(config.clipRange) ? config.clipRange : 0.2;
  const klCoefficient = Number.isFinite(config.klCoefficient) ? config.klCoefficient : 0.02;

  function evaluateGroup(group = {}) {
    const rewards = Array.isArray(group.rewards) ? group.rewards.map(Number) : [];
    const ratios = Array.isArray(group.ratios) ? group.ratios.map(Number) : [];
    if (!rewards.length) throw new Error("GRPO group requires at least one reward");
    if (ratios.length && ratios.length !== rewards.length) {
      throw new Error("GRPO rewards and ratios must have the same length");
    }

    const advantages = relativeAdvantages(rewards);
    const policyRatios = ratios.length ? ratios : rewards.map(() => 1);
    const clippedRatios = policyRatios.map(r =>
      Math.min(1 + clipRange, Math.max(1 - clipRange, r))
    );

    const surrogate = advantages.map((a, i) =>
      Math.min(policyRatios[i] * a, clippedRatios[i] * a)
    );
    const klProxy = policyRatios.map(r => Math.max(0, r - 1 - Math.log(Math.max(r, EPSILON))));
    const objective = mean(surrogate) - klCoefficient * mean(klProxy);

    return {
      groupId: group.groupId || null,
      size: rewards.length,
      rewards,
      meanReward: mean(rewards),
      rewardStd: standardDeviation(rewards),
      advantages,
      ratios: policyRatios,
      clippedRatios,
      surrogateMean: mean(surrogate),
      klProxyMean: mean(klProxy),
      objective,
      clipRange,
      klCoefficient
    };
  }

  function optimize(groups = []) {
    const evaluated = groups.map(evaluateGroup);
    const objectives = evaluated.map(g => g.objective);
    return {
      algorithm: "GRPO",
      groupCount: evaluated.length,
      sampleCount: evaluated.reduce((sum, g) => sum + g.size, 0),
      meanObjective: mean(objectives),
      groups: evaluated
    };
  }

  return { evaluateGroup, optimize, config: { clipRange, klCoefficient } };
}

module.exports = { createGRPO };
