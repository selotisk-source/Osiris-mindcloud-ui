# MindCloud / MindCore Principles

## Priority
MindCore and MindCloud are the primary system. Clients such as OSIRIS are subordinate validation and execution surfaces.

## Architecture
MindCore -> MindCloud -> Capabilities/Agents -> Execution Surfaces

OSIRIS, Brave Workstation, research tooling and future clients consume the same core contracts.

## Core loop
Observe -> Plan -> Route -> Act -> Verify -> Record Evidence -> Metanoia -> Replan/Promote

## Required properties
- adaptive complexity routing
- living DAG per project
- safe parallelization
- read/analysis separated from write/change
- typed contracts
- dynamic task injection and cancellation
- self-healing/recovery
- evidence-first promotion
- human gate for consequential changes
- client independence

## Design rule
No client-specific requirement may become a MindCore primitive unless it generalizes to the platform.
