# Mind Cave (MindCore)

Mind Cave is a bounded exploration planner. It keeps observations distinct from interpretations, leaves unknowns visible, delegates partial synthesis to The Joint, and traces evidence graphs through Recursive Trace. It does not treat hypotheses or evidence references as proof.

## API
`enterMindCave(input, {createJoint, recursiveTrace})`

- Required: `input.question`
- Optional: `hypotheses`, `observations`, `unknowns`
- Optional synthesis: `partials: { left, right }`
- Optional trace: `graph` and `traceRootId`, with `traceDirection`, `maxDepth`, `maxNodes`

The symbolic layer (the threshold, the path with Christ, and St Cyprianus) belongs in the product narrative/documentation, not in the evidence engine's truth claims.

Run `node scripts/verify-mind-cave.js`.
