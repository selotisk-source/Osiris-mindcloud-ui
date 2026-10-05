# MindCloud Tooling Integration Map

This branch records the implementation boundary for the projects supplied on 2026-10-05.

## Architecture

Third-party projects are integrated as **capability adapters**, not copied wholesale into the MindCloud core.

MindCore
  ├─ ModelRouter
  │    ├─ cloud providers
  │    ├─ Free Claude Code-compatible gateway
  │    └─ LiteRT-LM edge provider
  ├─ AgentRuntime
  │    ├─ ComputerAgent / CUA
  │    ├─ ResearchAgent
  │    └─ KnowledgeAgent / DeepTutor
  ├─ Domain Engines
  │    ├─ MarketResearch / Fincept adapter
  │    └─ SystematicTradingIndex / research catalogue
  ├─ MediaPipeline
  │    └─ Pixelle-style generation
  └─ Evidence
       ├─ screen capture / OpenScreen-style recorder
       └─ DocumentForensics / PDF redaction audit

## New additions from the latest screenshots

### Awesome Systematic Trading
Use `paperswithbacktest/awesome-systematic-trading` as a **research catalogue**, not as a live trading dependency. It currently describes a large set of libraries/packages, strategies, books, videos and courses. MindCloud should extract candidate strategies and tools into EvidenceGraph with source provenance, then hand approved candidates to a separate backtesting/execution boundary.

### PDF Redaction / Document Forensics
The `phishdestroy/taylor-wessing-data-breach-toolkit` project is a defensive forensic-auditing reference for detecting failed visual-only PDF redactions and inspecting hidden text layers offline. MindCloud gets a narrow `DocumentForensicsAdapter`: audit locally supplied documents, emit findings and hashes/provenance, and do not automatically expose recovered sensitive text.

## First build order

1. **ModelRouter + provider health/fallback** — gives every downstream agent a common model contract.
2. **ComputerAgent capability boundary** — lets agents operate real applications only inside an audited sandbox.
3. **EdgeRuntime adapter** — provides local/on-device inference as a routing option.
4. **MarketResearch + SystematicTradingIndex** — connects financial research to the evidence graph without granting the research index live-order authority.
5. **Research/Knowledge agents** — paper/dataset/document workflows.
6. **DocumentForensics + Media/Evidence capture** — defensive document auditing and polished run recordings.

## Important upstream findings

- ML Intern is archived, so it is a workflow reference rather than a live dependency.
- DS2API is archived; its API-normalization idea is useful, but account scraping/rotation is deliberately outside the MindCloud contract.
- OpenScreen is archived; use it as a reference and prefer its maintained successor for any future implementation.
- The Taylor Wessing forensic toolkit is an **audit input/reference**, not something to connect to external documents automatically.

The catalog is machine-readable at `integrations/tooling-catalog.json`.
