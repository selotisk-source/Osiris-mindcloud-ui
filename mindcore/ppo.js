function createPPO(config = {}) {
  const clipRange = Number(config.clipRange ?? 0.2);
  const valueCoefficient = Number(config.valueCoefficient ?? 0.5);
  const entropyCoefficient = Number(config.entropyCoefficient ?? 0.01);

  function clippedRatio(ratio) {
    return Math.min(1 + clipRange, Math.max(1 - clipRange, Number(ratio)));
  }

  function objective({ ratios = [], advantages = [], valueErrors = [], entropy = 0 }) {
    const n = Math.min(ratios.length, advantages.length);
    const policyTerms = [];
    for (let i = 0; i < n; i++) {
      const ratio = Number(ratios[i]);
      const advantage = Number(advantages[i]);
      const unclipped = ratio * advantage;
      const clipped = clippedRatio(ratio) * advantage;
      policyTerms.push(Math.min(unclipped, clipped));
    }
    const policyObjective = policyTerms.length ? policyTerms.reduce((a,b)=>a+b,0)/policyTerms.length : 0;
    const valueLoss = valueErrors.length ? valueErrors.reduce((a,b)=>a + Number(b) ** 2, 0)/valueErrors.length : 0;
    return {
      algorithm: "PPO",
      clipRange,
      policyObjective,
      valueLoss,
      entropyBonus: Number(entropy) * entropyCoefficient,
      totalObjective: policyObjective - valueCoefficient * valueLoss + Number(entropy) * entropyCoefficient
    };
  }

  return { clippedRatio, objective };
}
module.exports = { createPPO };
