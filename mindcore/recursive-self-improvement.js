function createRecursiveSelfImprovement(config = {}) {
  const maxHistory = Number.isInteger(config.maxHistory) ? Math.max(1, config.maxHistory) : 64;
  const versions = [];
  let activeVersion = config.initialVersion || "v0";

  function propose({ target, baseline, hypothesis, change, expectedGain, risk = 0 }) {
    return {
      target,
      baseline,
      hypothesis,
      change,
      expectedGain: Number(expectedGain ?? 0),
      risk: Number(risk ?? 0),
      status: "proposed",
      createdAt: new Date().toISOString()
    };
  }

  function evaluate(proposal, testResult = {}) {
    const gain = Number(testResult.gain ?? proposal.expectedGain ?? 0);
    const risk = Number(testResult.risk ?? proposal.risk ?? 0);
    const evidence = Number(testResult.evidence ?? 0);
    const passed = Boolean(testResult.passed) && evidence >= 0.7 && gain > risk;
    return {
      ...proposal,
      gain,
      risk,
      evidence,
      passed,
      status: passed ? "validated" : "rejected",
      evaluatedAt: new Date().toISOString()
    };
  }

  function adopt(evaluation, metadata = {}) {
    if (evaluation.status !== "validated") {
      throw new Error("Only validated improvements may be adopted");
    }
    const previousVersion = activeVersion;
    const nextVersion = metadata.version || `v${versions.length + 1}`;
    activeVersion = nextVersion;
    const record = {
      previousVersion,
      activeVersion: nextVersion,
      improvement: evaluation,
      rollbackTo: previousVersion,
      adoptedAt: new Date().toISOString()
    };
    versions.push(record);
    while (versions.length > maxHistory) versions.shift();
    return record;
  }

  function rollback(version = activeVersion) {
    const target = versions.find(v => v.activeVersion === version);
    if (!target) throw new Error(`Unknown version: ${version}`);
    activeVersion = target.rollbackTo;
    return { activeVersion, rolledBackFrom: version, timestamp: new Date().toISOString() };
  }

  function snapshot() {
    return { module: "Recursive Self Improvement", activeVersion, versions };
  }

  return { propose, evaluate, adopt, rollback, snapshot };
}

module.exports = { createRecursiveSelfImprovement };
