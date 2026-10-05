# MindCloud Tooling Integration Map

This branch records the first implementation boundary for the projects supplied on 2026-10-05.

## Architecture

Third-party projects are integrated as **capability adapters**, not copied wholesale into the MindCloud core.

MindCore\n  ├─ ModelRouter\n  │    ├─ cloud providers\n  │    ├─ Free Claude Code-compatible gateway\n  │    └─ LiteRT-LM edge provider\n  ├─ AgentRuntime\n  │    ├─ ComputerAgent / CUA\n  │    ├─ ResearchAgent\n  │    └─ KnowledgeAgent / DeepTutor\n  ├─ Domain Engines\n  │    └─ MarketResearch / Fincept adapter\n  ├─ MediaPipeline\n  │    └─ Pixelle-style generation\n  └─ Evidence\n       └─ screen capture / OpenScreen-style recorder

## First build order

1. **ModelRouter + provider health/fallback** — gives every downstream agent a common model contract.
2. **ComputerAgent capability boundary** — lets agents operate real applications only inside an audited sandbox.
3. **EdgeRuntime adapter** — provides local/on-device inference as a routing option.
4. **MarketResearch adapter** — connects financial research to the existing evidence graph.
5. **Research/Knowledge agents** — paper/dataset/document workflows.
6. **Media + Evidence capture** — video and polished run recordings.

## Important upstream findings

- ML Intern is archived, so it is a workflow reference rather than a live dependency.
- DS2API is archived; its API-normalization idea is useful, but account scraping/rotation is deliberately outside the MindCloud contract.
- OpenScreen is archived; use it as a reference and prefer its maintained successor for any future implementation.

The catalog is machine-readable at `integrations/tooling-catalog.json`.
