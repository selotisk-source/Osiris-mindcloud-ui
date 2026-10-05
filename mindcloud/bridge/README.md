# MindCloud ↔ RuFlo Bridge

This bridge makes RuFlo an execution layer behind the MindCloud contracts.

## Ownership

- **MindCore** owns typed state, task graphs, policy and verification primitives.
- **Dirigentverket** owns orchestration policy, routing decisions, gates and workload control.
- **RuFlo** owns agent/swarm execution behind the transport boundary.
- **Evidence** remains first-class and returns with every consequential execution.
- **Metanoia** evaluates contradictions and affected model changes before promotion.
- **OSIRIS** is a validation client, not a MindCore primitive.

## Flow

`Task → Dirigentverket → Bridge → RuFlo → Agents/Tools → Evidence → Metanoia → Gate → MindCore`

The adapter deliberately does not import RuFlo directly. This keeps the platform replaceable and lets the transport be backed by MCP, a local process, or another execution provider.

## First validation task

`createOsirisVerificationTask()` defines the first read-only OSIRIS endpoint verification flow.

Production mutation is outside the bridge contract and requires an explicit human gate.
