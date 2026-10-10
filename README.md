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

## MindCloud Arena Skill

Arena is registered in the MindCore capability catalog and the MindCloud capability graph as **Arena → Evaluate → Verify**. It compares competing candidates using the same task and test contract, applies deterministic scoring, and rejects any candidate with a failed test, failed required check, or missing test evidence.

- Skill contract: `skills/arena/SKILL.md`
- Evaluator and gated promotion proposal: `mindcore/arena-skill.js`
- Independent checks: `scripts/verify-arena-skill.js`
- Included in the standard `npm run verify` sequence.

Arena reports do not deploy code or write to the capability registry. Skill promotion requires a verified winner, explicit approval, and successful revalidation; registry persistence remains a separate audited operation.

## Integrated agent toolchain

MindCore now has typed supervised adapter contracts for ten external capabilities:

- **Graft** — codebase context and graph operations.
- **Codebase Memory MCP** — local structural code intelligence and knowledge-graph queries.
- **OpenMontage** — supervised agentic video production.
- **Browser Use** — controlled browser/computer-agent execution.
- **AgentMemory** — persistent cross-agent coding memory.
- **Scientific Agent Skills** — reusable scientific/research Agent Skills.
- **Diagram Design** — editorial architecture and evidence diagrams.
- **Anthropic Cybersecurity Skills** — authorized security-research and defensive skill library.
- **Awesome Harness Engineering** — harness-engineering reference/evaluation layer.
- **OpenViking** — inspectable context database for knowledge, memory and skills.

The integrations are execution-surface adapters: MindCore keeps routing, approval, audit and promotion authority. External credentials, browser sessions, filesystem/process access and third-party runtimes remain outside agent identity and behind explicit execution domains.

Cognee remains the knowledge-memory adapter and is registered when `COGNEE_ENDPOINT` is configured.

## ARGOS ATLAS GeoOSINT

ARGOS ATLAS is registered as an external GeoOSINT capability for OSIRIS/MindCore. The adapter exposes a typed entry point for opening/describing the atlas and records the requested geographic layer in the MindCore audit stream. Supported conceptual layers include cameras, flights, ships, infrastructure, events, markets and risk zones.

The integration deliberately stops at the official public surface until ARGOS ATLAS's advertised API/MCP interfaces are generally available. No private endpoint, undocumented scraping contract or credential flow is assumed.

## Grounded Spatial Intelligence

MindCore now registers a supervised **Grounded API / GroundedSLAM** adapter in the Spatial Intelligence layer. The intended flow is validated spatial output (SLAM/depth/related signals) → OSIRIS Geo → ARGOS ATLAS. The adapter does not assume undocumented endpoints; live API use requires an explicitly configured GROUNDED_API_ENDPOINT and verified authentication/schema.

## Cost-aware integration policy

- Registration and free API tokens are acceptable; do not purchase a subscription or prepaid API credits without an explicit decision.
- Prefer public, no-key endpoints or self-hosted/open-data alternatives where practical.
- **Mapillary** is the default free street-level imagery alternative; register an application, then set `MAPILLARY_ACCESS_TOKEN` in the deployment environment. It has no service fee according to its current FAQ.
- **Subdomain discovery** uses passive Certificate Transparency via crt.sh and Cloudflare DNS-over-HTTPS; no paid scanning or active probing is performed. Set the server-side `MINDCLOUD_AUTHORIZED_DOMAINS` comma-separated allowlist before execution; client-supplied approval is not trusted.
- **Cookie inspection** is local to the browser extension, user-initiated, scoped to the active tab, metadata-only, and never transmits cookie values.
- Google Street View imagery, Shodan features requiring paid credits/plans, and the hosted OpenSanctions screening API remain parked pending a cost/licensing review. OpenSanctions bulk data is only a candidate for non-commercial use under its stated license; do not assume it is cleared for commercial use.
