function createInContextLearning(config = {}) {
  const maxExamples = Number.isInteger(config.maxExamples) ? Math.max(1, config.maxExamples) : 8;

  function buildContext({ examples = [], instructions = [], task = {} }) {
    return {
      type: "in_context_learning",
      examples: examples.slice(-maxExamples),
      instructions: Array.isArray(instructions) ? instructions : [instructions],
      task,
      exampleCount: Math.min(examples.length, maxExamples),
      strategy: "retrieve-relevant-context-then-infer"
    };
  }

  function selectExamples({ examples = [], relevance = {} }) {
    return [...examples]
      .map((example, index) => ({ example, score: Number(relevance[index] ?? example.score ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxExamples);
  }

  return { buildContext, selectExamples };
}
module.exports = { createInContextLearning };
