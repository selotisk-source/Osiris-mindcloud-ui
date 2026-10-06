function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function createMonteCarlo(config = {}) {
  const samples = Number.isInteger(config.samples) ? Math.max(1, config.samples) : 1000;

  function run({ sample = () => Math.random(), score = x => x } = {}) {
    const values = Array.from({ length: samples }, (_, i) => {
      const value = sample(i);
      return { index: i, value, score: Number(score(value, i)) };
    });
    const scores = values.map(v => v.score);
    return {
      algorithm: "Monte Carlo",
      sampleCount: samples,
      candidates: values,
      statistics: {
        mean: mean(scores),
        p50: percentile(scores, 0.5),
        p90: percentile(scores, 0.9),
        p95: percentile(scores, 0.95),
        min: Math.min(...scores),
        max: Math.max(...scores)
      },
      resultType: "simulation"
    };
  }

  return { run, config: { samples } };
}

module.exports = { createMonteCarlo };
