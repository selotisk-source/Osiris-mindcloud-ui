# MindCore Core Contracts

## Task
id, project, objective, priority, dependencies, required capabilities, inputs, expected outputs, verification requirements, status.

## Agent
id, role, capabilities, tools, input/output contracts, evidence requirements, write permissions.

## Capability
id, category, input contract, output contract, execution mode, permissions, verification method, health state.

## Evidence
source, observation, timestamp, provenance, confidence, verification state, affected claims.

## Promotion
affected model/subgraph, supporting evidence, tests/experiments, contradictions considered, version/rollback reference, human-gate state.

## State
proposed -> planned -> running -> verifying -> accepted
or
proposed/planned/running/verifying -> rejected/blocked
