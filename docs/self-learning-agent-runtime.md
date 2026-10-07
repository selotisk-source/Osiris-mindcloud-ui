# Self-Learning Agent Runtime

MindCloud adopts the useful architectural pattern exposed by AutoHarness without making it the core itself.

## Roles

- **Experience capture**: collect successful and failed agent-session outcomes.
- **Skill extraction**: derive reusable capabilities from real sessions.
- **Scenario merge**: merge near-duplicate skills instead of accumulating copies.
- **Validation gate**: proposed skill changes remain proposals until evidence and policy checks pass.
- **Versioned promotion**: promoted skills are immutable versions with provenance.
- **Usage-aware pruning**: stale skills can be retired when they stop providing value.
- **Evidence linkage**: every promotion records why the skill changed and what evidence supported it.

## MindCore integration

`MindCore → Experience → Metanoia → Proposal → Validation Gate → Versioned Skill → Capability Graph → Router`

Metanoia remains the contradiction/anomaly and counterfactual layer. The learning subsystem does not bypass approval or security boundaries.

## Runtime pattern

OpenCode-style shared server/runtime semantics are treated as a reference for exposing one execution service to multiple clients/stations. Client identity is not security identity; credential, browser, file and tool isolation remains in explicit execution domains.

## Model pool

MiMo-V2.6-Pro is registered as a frontier-model reference candidate for long-context, multimodal and long-horizon workloads. It is not assumed to be the production default until benchmarked.

## Design rule

The objective is not maximum number of agents or skills. The objective is a clean, evidence-backed capability graph with adaptive routing and controlled self-improvement.
