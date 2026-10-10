# RuFlo Integration

RuFlo is the execution fabric for MindCloud, not MindCore.

Boundary: MindCloudTask → RufloExecutionRequest → ExecutionResult.

Initial OSIRIS validation: hierarchical-mesh, maxAgents 8, specialized, read-only, human gate required.

Acceptance: HTTP status → JSON → camera metadata → stream → proxy → actual frame → Evidence → Metanoia → Gate → MindCore.
