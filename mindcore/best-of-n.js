function createBestOfN(config = {}) {
  const defaultN = Number.isInteger(config.n) ? Math.max(1, config.n) : 8;

  function select(candidates = [], score = x => Number(x.score ?? x)) {
    if (!Array.isArray(candidates) || !candidates.length) {
      throw new Error("Best-of-N requires candidates");
    }
    const ranked = candidates
      .map((candidate, index) => ({ candidate, index, score: Number(score(candidate, index)) }))
      .sort((a, b) => b.score - a.score);
    const n = Math.min(defaultN, ranked.length);
    return {
      algorithm: "Best-of-N",
      candidateCount: ranked.length,
      n,
      selected: ranked.slice(0, n),
      winner: ranked[0],
      resultType: "selection"
    };
  }

  return { select, config: { n: defaultN } };
}

module.exports = { createBestOfN };
