# Osiris-mindcloud-ui

MindCloud/MindCore reference implementation and visualization surface.

## Architecture

**MindCore → MindCloud → capabilities → clients**

MindCore owns typed state, task graphs, capability routing, lifecycle, policy and verification. OSIRIS is a client/testbed, not the architectural core.

## Current reference patterns

- **AutoHarness** → self-learning skill lifecycle: extract, merge, validate, version, prune.
- **OpenCode** → shared agent runtime/server pattern for multiple clients.
- **MiMo-V2.6-Pro** → frontier multimodal/long-context model candidate for the model pool.

These patterns are integrated as explicit capability/runtime references rather than copied wholesale.

## Core principles

- adaptive complexity routing
- living project DAGs
- parallelization where safe
- separation of read/analysis from write/change
- typed contracts
- dynamic task injection/cancellation
- self-healing with evidence and verification
- agent identity separated from security identity
- Metanoia revalidation before consequential promotion
