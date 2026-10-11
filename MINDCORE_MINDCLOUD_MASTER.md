# MindCore & MindCloud — Master Handover
**Version:** 1.1 | **Updated:** 2026-10-11  
**Purpose:** durable project context for Claude and any collaborator continuing work across chats.

## Read this first
This is a living engineering project, not a brainstorming exercise. Use this document with `MINDCORE_CURRENT_STATE.md`, `MINDCORE_DECISIONS.md` (if present), the repository, and test results. Do not assume another chat is accessible. Persist important discoveries here or in the state/changelog files.

## The system in one minute
- **MindCore** is the cognitive and execution core: typed state, task lifecycle, planning, capability routing, policy/approval gates, evidence, verification and controlled decisions.
- **MindCloud** is the distributed environment/network that connects agents, tools, services, data and clients through shared contracts and state.
- **Dirigentverket** is the orchestration layer: decomposes goals into a living DAG, routes work, runs independent tasks in parallel, manages dependencies/cancellation/retries and reunites results.
- **Metanoia Engine** is the mandatory revalidation mechanism: detect contradictions/anomalies, test alternatives, update only affected model subgraphs, version changes and preserve why a change occurred.
- **Evidence Layer / Evidence Passport** records claims, source/provenance, tests, timestamps, results, uncertainty and verification status.
- **OSIRIS** is a client and end-to-end testbed on top of MindCore/MindCloud. It is not the core and must not dictate the architecture.
- **Adapters** expose external capabilities behind typed, supervised contracts. Routing, approval, audit and promotion authority stay in MindCore.

Intended flow: `Task → MindCore → MindCloud/Dirigentverket → Capability/Adapter → Evidence + Verification → Result → Client`. A diagram or registered adapter does not prove that the runtime or deployment works.

## Architecture invariants
1. Adaptive complexity routing; living per-project DAG; parallelize only independent/safe work.
2. Separate read/analysis from write/change. Make side effects explicit and auditable.
3. Use typed input/output contracts, stable adapter boundaries, explicit error states and versioning.
4. Persist task state and evidence so work can resume after a chat, process or deployment interruption.
5. Separate agent identity from security identity. Enforce server-side auth/authorization; never trust client-supplied approval.
6. No consequential state promotion without Metanoia revalidation and the required human approval gate. Routine decisions may be autonomous only within an explicit mandate and risk policy.
7. No claim of completion without evidence. Distinguish planned, implemented, tested, deployed and end-to-end verified.
8. Do not buy subscriptions or prepaid API credits without explicit approval. Prefer open-source, self-hosted and free/public options where practical.
9. Reuse the existing repository and implementation; inspect before replacing or rebuilding.
10. Do not expose secrets in logs, client bundles, commits or handover documents.

## Repo-specific facts already documented
Repository: https://github.com/selotisk-source/Osiris-mindcloud-ui  
Default branch: `main`. Public deployment previously referenced: https://osiris-mindcloud.up.railway.app (deployment health must be checked, not assumed).

The repository README documents:
- Arena capability flow `Arena → Evaluate → Verify`; candidate promotion requires a verified winner, explicit approval and revalidation. Arena itself must not deploy code or write to the registry.
- Supervised adapter patterns for Graft, Codebase Memory MCP, OpenMontage, Browser Use, AgentMemory, Scientific Agent Skills, Diagram Design, Anthropic Cybersecurity Skills, Awesome Harness Engineering and OpenViking.
- Cognee as a knowledge-memory adapter when `COGNEE_ENDPOINT` is configured.
- ARGOS ATLAS GeoOSINT and Grounded API / GroundedSLAM as constrained adapters; do not assume undocumented APIs or authentication.
- Passive subdomain discovery only, with server-side authorized-domain allowlist; browser cookie inspection is local, user-initiated and metadata-only.
These are repository-documented patterns. Verify each capability’s actual runtime status independently.

## Role of Claude
Act as an engineering collaborator and continuity keeper. Inspect actual files, tests, branches, issues, CI and deployment evidence when tools are available. Make changes, run tests and update persistent project state; do not merely explain what someone should do.

### Work protocol
1. Read this handover and current state; inspect relevant code and recent commits before acting.
2. Convert the user’s goal into a testable acceptance criterion.
3. Find the smallest safe implementation path and reuse existing code.
4. Make the change using available tools.
5. Run the narrowest relevant test, then broader verification where feasible.
6. Report exact files/commit/PR, commands or checks actually run, outcomes, and remaining blockers.
7. Update `MINDCORE_CURRENT_STATE.md` and decision/changelog records after meaningful changes.
8. Continue to the next unblocked task; do not stop at a plan if execution is available.

If blocked, identify the precise missing permission, secret, external action or failing check; continue independent work. Never claim a test, deployment, commit or integration succeeded unless its result was observed.

## Cross-chat memory protocol
- Keep this master stable; update it only when architecture or durable invariants change.
- Keep `MINDCORE_CURRENT_STATE.md` short and current: verified baseline, active milestone, completed work, failed checks, blockers, next concrete action.
- Maintain `MINDCORE_DECISIONS.md` for dated decisions and rationale and `MINDCORE_CHANGELOG.md` for verified changes. Create these files if missing and useful.
- End each substantial session by writing a handover: exact state, evidence, unresolved questions and next action. Do not rely on chat history alone.
- At the start of a new chat, reconcile saved state with repository reality. If they conflict, trust fresh reproducible evidence and document the discrepancy.

## Definition of done
A feature is not done merely because code or UI exists. Use the feature’s acceptance criteria. For an end-to-end flow, verify request → auth/policy → task creation → routing → real capability execution → result → evidence/status persistence → client display, including error paths as relevant. A health endpoint alone is not proof of functional correctness.

## Immediate instruction
Read `MINDCORE_CURRENT_STATE.md`, inspect the live repository and test setup, then take the next concrete engineering action toward a functioning MindCore/MindCloud backend↔frontend execution loop. Prioritize adapter contract/connection, persisted state, verification and truthful status reporting. Update the state file with actual evidence before finishing.
