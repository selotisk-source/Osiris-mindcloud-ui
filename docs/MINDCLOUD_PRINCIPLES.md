# MindCloud / MindCore Principles

MindCore and MindCloud are the primary system. OSIRIS and other applications are clients, sensors, or validation surfaces.

## Architecture
MindCore -> MindCloud -> Capabilities / Agents -> Execution Surfaces

## Core loop
Observe -> Plan -> Route -> Act -> Verify -> Record Evidence -> Metanoia -> Replan or Promote

## Required properties
- adaptive complexity routing
- living DAG per project
- safe parallelization
- separation of read/analysis from write/change
- typed contracts
- dynamic task injection and cancellation
- self-healing and recovery
- evidence-first promotion
- human gate for consequential changes
- client independence

## Design rule
No client-specific requirement becomes a MindCore primitive unless it generalizes to the platform.
