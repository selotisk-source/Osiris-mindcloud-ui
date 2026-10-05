# MindCore runtime boundary

The new runtime is deliberately adapter-first.

- ModelRouter: ordered provider selection, health checks and failover.
- CapabilityRegistry: one typed registry for all agent/tool capabilities.
- MindOrchestrator: common task lifecycle and audit events.
- ApprovalGate: explicit approval levels for consequential capabilities.
- EvidenceGraph: attaches artifacts and run events to a traceable graph.
- Catalog: one machine-readable inventory of the supplied projects.

The first concrete computer-use capability is gated at admin approval and records an audit event. External runtimes remain behind adapters until their actual process/API endpoint is connected.

## Intended execution path

request -> orchestrator -> capability -> provider/tool -> result -> evidence -> audit

This preserves the MindCloud separation between read/analysis and write/change, while allowing future adapters to be enabled independently.
