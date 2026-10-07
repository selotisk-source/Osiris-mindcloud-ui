# External R&D Capability Contracts

These are adapter boundaries, not vendored third-party runtimes.

## OpenPlanter

- capability: `investigation`
- request: `InvestigationRequest`
- output: `InvestigationFinding[] + GraphArtifact`
- evidence gate: every promoted finding must retain source/provenance metadata
- execution: isolated workspace; no unrestricted credential inheritance
- status: planned adapter

## AERIS-10 / PLFM_RADAR

- capability: `radar_sensor`
- request: `SensorObservationRequest`
- output: `SensorObservation[]`
- evidence gate: sensor timestamp, sensor identity, calibration/configuration metadata and acquisition status
- execution: separate hardware/FPGA domain; read-only into MindCore
- actuator authority: none
- status: research index

## vgpu

- capability: `gpu_compute`
- request: `GpuComputeRequest`
- output: `GpuArtifact`
- validation: deterministic mock first, then headless Node, then browser runtime
- execution: isolated GPU workload; no credentials
- status: planned adapter

## Promotion rule

No external capability is promoted to a trusted MindCore path merely because the upstream repository exists. The adapter, output schema, health state and evidence/provenance must be verified independently.

## Orca

- capability: `agent_execution`
- request: `ExecutionDispatch`
- output: `AgentExecutionReceipt + WorktreeRef`
- evidence gate: execution output must retain task, agent, worktree, commit and validation metadata before promotion
- execution: isolated worktree/process boundary selected by MindCloud policy
- status: planned adapter

## Shared execution rule

Orca is an execution surface. MindCloud remains authoritative for routing policy, security identity, credential domains and evidence promotion. Task completion in Orca does not automatically promote an artifact into MindCore.
