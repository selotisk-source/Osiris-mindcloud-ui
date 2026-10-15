# RuFlo Integration

## Decision

RuFlo is the execution fabric for MindCloud, not the MindCore.

The integration follows the existing MindCloud principles:

- adaptive complexity routing
- living DAG per project
- safe parallelization
- read/analysis separated from write/change
- typed contracts
- dynamic task injection/cancellation
- recovery/self-healing
- evidence-first promotion
- human gates for consequential changes
- client independence

## Runtime

RuFlo currently supports project initialization through `npx ruflo@latest init` and exposes its orchestration surface through an MCP server. The official project documentation also describes adaptive/hierarchical-mesh topology and configurable agent limits.

For Codex, the RuFlo project documentation describes registering the same MCP server and explicitly recommends a read-only call as the connectivity success check.

## Integration boundary

MindCloud must communicate with RuFlo through the bridge transport contract:

`MindCloudTask → RufloExecutionRequest → ExecutionResult`

No RuFlo-specific state is promoted directly into MindCore. Execution results first become Evidence records, then pass through Metanoia/verification and the appropriate promotion gate.

## Initial topology

The first OSIRIS validation uses:

- topology: `hierarchical-mesh`
- max agents: 8
- strategy: `specialized`
- read-only execution
- human gate: required

This is intentionally conservative. Agent count and topology remain configuration, not MindCore primitives.

## Bootstrap

In a checked-out development workspace:

```bash
npx ruflo@latest init
npx ruflo@latest doctor --fix
```

Then register RuFlo as an MCP server in the execution client using the current RuFlo documentation.

Do not treat a configuration entry as proof of connectivity. The first acceptance test is a successful read-only RuFlo call returning an actual result.

## OSIRIS acceptance chain

1. Build the typed OSIRIS verification task.
2. Dirigentverket validates permissions and dependencies.
3. Bridge submits the execution request to RuFlo.
4. RuFlo coordinates specialized agents.
5. Agents collect observations.
6. Bridge converts observations into Evidence records.
7. Metanoia checks contradictions and affected claims.
8. Human gate decides consequential promotion.
9. MindCore records the accepted/rejected state transition.

## Future adapters

The same bridge can expose:

- research tools
- GitHub/code agents
- security review
- market analysis
- mineral/energy research
- workstation/browser execution

without making those vendors MindCore dependencies.
