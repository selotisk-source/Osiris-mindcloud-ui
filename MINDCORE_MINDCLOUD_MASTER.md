# MindCore & MindCloud — Master Handover
**Version:** 1.2 | **Updated:** 2026-10-13
**Purpose:** durable project context for collaborators continuing work across chats.

## Read this first
This is a living engineering project, not a brainstorming exercise. Use this document with `MINDCORE_CURRENT_STATE.md`, the repository, and observed test/deployment results. Do not assume another chat is accessible. Persist important discoveries in state/decision records.

## The system in one minute
- **Regenten**: the authorized leader/authority identity that establishes mission intent and the boundaries of its mandate. “Regenten” is role-neutral and can represent a king or queen.
- **Di Regenten**: the leadership/control function that translates authorized intent into priorities, delegated missions, constraints, approval gates and outcome review. It is a function, not a second competing orchestrator.
- **MindCore**: shared cognitive/execution core for typed state, task lifecycle, capability routing, policy, evidence, verification and controlled decisions. It supplies the common operational picture; it does not grant itself unlimited authority.
- **MindCloud**: distributed environment/network connecting agents, tools, services, data and clients through shared contracts and state.
- **Formation Engine**: organizes agents into roles, groups and subgroups; checks capability/dependency fit; can regroup when mission conditions change. It proposes/maintains formation, but does not independently become the task scheduler.
- **Dirigentverket**: the single execution orchestrator. It decomposes goals into a living DAG, routes work, runs safe independent tasks in parallel, manages dependencies/cancellation/retries and reunites results.
- **Hivemind**: a potential bounded planning/DAG capability behind an adapter; it must not become a second authority or competing orchestrator.
- **Metanoia Engine**: revalidation mechanism for contradictions/anomalies, alternative hypotheses and counterfactuals. It versions localized model changes and preserves why they occurred; consequential promotion still requires policy and approval.
- **Evidence Layer / Evidence Passport**: records claims, provenance, tests, timestamps, results, uncertainty and verification status.
- **OSIRIS**: a client and end-to-end testbed on top of MindCore/MindCloud. It is not the core and must not dictate the architecture.
- **Adapters**: expose external capabilities behind typed, supervised contracts. Routing, approval, audit and promotion authority stay in MindCore.

## Canonical control flow
`Regenten (intent + mandate) → Di Regenten (priorities + constraints + approvals) → Formation Engine (roles + membership) → Dirigentverket (task DAG + execution) → agents/adapters → evidence + verification → MindCore shared state → Di Regenten/Regenten review`

MindCore provides shared state and policy across the flow; it is not merely a terminal layer. Feedback may trigger re-planning or formation changes, but only within the mandate and policy. Keep formation management distinct from task orchestration and both distinct from evidence/analysis.

## Mandate and mission contract
Every executable mission should carry, or resolve server-side to, a typed and versioned contract with at least:
- `mission_id`, `mandate_id`, `regent_id`, `issued_by`, `issued_at`
- `authority_scope`, `constraints`, `risk_class`, `resource_limits`, `deadline` where relevant
- `formation_id`, `execution_plan_id`, `parent_task_id` and dependency references
- `approval_gate`, `evidence_required`, `verification_policy`
- `status`, `version`, `correlation_id`, and audit/evidence references

These are target contract fields, not a claim that all fields already exist in code. Authorization must be enforced server-side; an agent identity is not a security identity, and client-supplied approval is never trusted. A mission outside scope must be denied or paused, not silently widened.

## Architecture invariants
1. Adaptive complexity routing; living per-project DAG; parallelize only independent/safe work.
2. Separate read/analysis from write/change. Make side effects explicit and auditable.
3. Use typed input/output contracts, stable adapter boundaries, explicit error states and versioning.
4. Persist task state and evidence so work can resume after a chat, process or deployment interruption.
5. Separate agent identity from security identity. Enforce server-side auth/authorization; never trust client-supplied approval.
6. No consequential state promotion without Metanoia revalidation and the required human approval gate. Routine decisions may be autonomous only within an explicit mandate and risk policy.
7. No claim of completion without evidence. Distinguish planned, implemented, tested, deployed and end-to-end verified.
8. No subscriptions or prepaid API credits without explicit approval. Prefer open-source, self-hosted and free/public options where practical.
9. Reuse the existing repository and implementation; inspect before replacing or rebuilding.
10. Do not expose secrets in logs, client bundles, commits or handover documents.
11. Exactly one execution orchestrator owns task scheduling and lifecycle: Dirigentverket unless an explicit, tested architectural decision replaces it.
12. Formation changes, replanning, retries and recovery are policy-bound, auditable and must preserve mission scope.
13. Failed, stale, missing or contradictory evidence must never be silently upgraded to verified.

## Repo-specific facts already documented
Repository: https://github.com/selotisk-source/Osiris-mindcloud-ui
Default branch: `main`. Public deployment referenced in project history: https://mindcloud-live.up.railway.app; deployment health must be checked, not assumed.

The repository README documents:
- Arena capability flow `Arena → Evaluate → Verify`; candidate promotion requires a verified winner, explicit approval and revalidation. Arena itself must not deploy code or write to the registry.
- Supervised adapter patterns for Graft, Codebase Memory MCP, OpenMontage, Browser Use, AgentMemory, Scientific Agent Skills, Diagram Design, Anthropic Cybersecurity Skills, Awesome Harness Engineering and OpenViking.
- Cognee as a knowledge-memory adapter when `COGNEE_ENDPOINT` is configured.
- ARGOS ATLAS GeoOSINT and Grounded API / GroundedSLAM as constrained adapters; do not assume undocumented APIs or authentication.
- Passive subdomain discovery only, with server-side authorized-domain allowlist; browser cookie inspection is local, user-initiated and metadata-only.
These are repository-documented patterns. Verify each capability’s actual runtime status independently.

## Role of collaborators
Inspect actual files, tests, branches, issues, CI and deployment evidence when tools are available. Make changes, run tests and update persistent project state; do not merely explain what someone should do.

### Work protocol
1. Read this handover and current state; inspect relevant code and recent commits before acting.
2. Convert the user’s goal into a testable acceptance criterion.
3. Find the smallest safe implementation path and reuse existing code.
4. Make the change using available tools.
5. Run the narrowest relevant test, then broader verification where feasible.
6. Report exact files/commit/PR, checks actually run, outcomes and remaining blockers.
7. Update `MINDCORE_CURRENT_STATE.md` and decision/changelog records after meaningful changes.
8. Continue to the next unblocked task; do not stop at a plan if execution is available.

If blocked, identify the precise missing permission, secret, external action or failing check; continue independent work. Never claim a test, deployment, commit or integration succeeded unless its result was observed.

## Cross-chat memory protocol
- Keep this master stable; update it only when architecture or durable invariants change.
- Keep `MINDCORE_CURRENT_STATE.md` current: verified baseline, active milestone, completed work, failed checks, blockers and next concrete action.
- Maintain dated decision and changelog records if useful; do not create duplicate sources of truth.
- End substantial sessions by recording exact state, evidence, unresolved questions and next action.
- At the start of a new chat, reconcile saved state with repository and fresh test evidence. If they conflict, trust fresh reproducible evidence and document the discrepancy.

## Definition of done
A feature is not done merely because code or UI exists. For an end-to-end flow, verify request → auth/policy → mission/task creation → formation/routing → real capability execution → result → evidence/status persistence → client display, including error paths as relevant. A health endpoint alone is not proof of functional correctness.

## Immediate engineering priority
Advance the real MindCore/MindCloud backend↔frontend execution loop and introduce the Regenten/Di Regenten model incrementally. First map existing task, policy, adapter and evidence contracts to this model. Avoid a big-bang rewrite or a second scheduler. Update current state with exact evidence before finishing.


## 2026-10-13 — Mission contract handoff and guarded execution

The mission contract now crosses a concrete code boundary rather than remaining documentation only:

1. `mindcore/mission-contract.js` validates the shape and consistency of a mission contract.
2. `agentCluster.planMission()` creates a plan-only formation handoff carrying mission identity, authority scope, constraints, evidence requirements and the execution-plan ID. It does not enable tool execution.
3. `POST /api/mindcloud/agent-cluster/mission-plan` is the authenticated planning endpoint.
4. `POST /api/mindcloud/agent-cluster/mission-execute` resolves the mission from a server-owned in-memory registry, then requires exact `tool:operation` scope, an allowlisted operation, non-empty evidence requirements and a server-side single-use approval ticket bound to the exact action input. Approval replay and a second execution attempt are denied. State transitions to `needs_review` after the action until an independent verifier is available.
5. The existing adapter runtime and evidence capture are reused; no parallel scheduler is introduced.

**Important limits:** this is not yet a complete autonomous Dirigentverket runtime. The mission registry is in-memory (30-minute TTL), not durable across restarts. The request-provided `regent_id` is not yet authenticated against a trusted Regent identity. The approval ticket authorizes only the exact action it was created for. Continue by binding Regent identity to trusted server-side authentication, persisting mission records/audit, then proving the full flow in CI and staging before deployment.
