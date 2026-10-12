# MindCore / MindCloud — Current State
**Last reconciled:** 2026-10-13  
**Source of truth:** repository files and newly observed test/deployment results. This file must be updated after meaningful work.

## Verified from repository metadata in this session
- Repository exists: `selotisk-source/Osiris-mindcloud-ui`.
- Default branch: `main`.
- Connected GitHub integration reports push/admin access.
- `README.md` describes MindCore as owner of typed state, task graphs, capability routing, lifecycle, policy and verification; OSIRIS is a client/testbed.
- README documents an Arena skill and verification script: `skills/arena/SKILL.md`, `mindcore/arena-skill.js`, `scripts/verify-arena-skill.js`, and says it is part of `npm run verify`.
- README describes multiple supervised adapters and guarded promotion/approval behavior.

## Deployment verification — 2026-10-11
- Latest backend deployment `a4d43a34-88a1-40aa-9fbd-4012a630f85b` is `SUCCESS` on commit `ee508a851a744c08204a0e3d9ece234f2eaf998a`.
- Latest frontend deployment `99085441-80cd-4629-a8be-1cf6a84df100` is `SUCCESS` on the same commit.
- The frontend pre-deploy command completed `node scripts/run-verify.js` with the explicit result `MindCloud verification suite passed.` This included runtime, Cognee persistence, adapter route/contracts/failure audit, Arena, Speech Figure promotion gate, four-station workspace layout, provider-network, agent-cluster and OSIRIS console checks.
- Backend startup self-test on the latest backend deployment logged `status: passed`: all four core checks passed, Cognee health and write/readback persistence passed, and Browser Use executed successfully with HTTP 200.
- Frontend production smoke on the preceding successful deployment returned HTTP 200 for `/health`, `/ready`, `/osiris`, `/api/mindcloud/status`, valid Arena evaluation, `/api/adapters`, `/api/agent-tools` and `/api/cctv`. Invalid Arena input returned the expected 400; unauthorized Metanoia approval and adapter execution returned the expected 401.
- `server.js` coalesces overlapping deep self-tests and caches the last deep result for six hours while refreshing Cognee and Browser Use health. The last-hour production self-test count is 22 HTTP 200 and 3 HTTP 502; all 3 failures occurred in the 02:28 UTC rollout bucket. Subsequent buckets from 02:29 through 02:35 UTC had no self-test 5xx, and cache-enabled requests returned HTTP 200 in 49 ms and 55 ms.
- The cache initially caused the Cognee test-mode verifier to reuse the startup result. This was corrected so `NODE_ENV=test` bypasses the cache; the complete verification suite then passed on the latest frontend deployment.
- Latest environment status: all five services online, no pending work, and no current service failures. The frontend has one historical failed deployment from the intermediate cache/test mismatch; the subsequent deployment succeeded.

## Still not verified
- Three simultaneous production `POST /api/mindcloud/selftest` requests returned 502 during an earlier rollout with upstream connection-closed/refused errors. Cache-enabled requests subsequently returned quickly and the latest deployments are healthy, but a controlled repeat of the exact three-request scenario has not been completed.
- The complete production backend → authorized adapter execution → persisted evidence/state → frontend display flow has not been verified as one transaction, although the local adapter-route suite verifies adapter output linked to evidence-graph nodes.
- Not every README-listed adapter has been proven executable in production; some correctly remain credential-gated or research-only.
- GitHub commit-status API returned no status checks for the inspected commits; the Railway pre-deploy verification is the observed green suite.

Do not silently convert these items into “working” status without fresh evidence.

## Live verification refresh — 2026-10-11 15:46 Europe/Sofia

- Railway production environment `lively-nurturing` was queried directly: all five services are online, each has one running replica, there are zero current service failures, zero warnings/criticals, and no pending staged/deployment work.
- Current backend `mindcloud-osiris` deployment `a4300731-dad5-458c-b433-49cb09babfec`: `SUCCESS`; persistent runtime volume `/data` is attached.
- Current frontend `Osiris-mindcloud-ui` deployment `b2c63945-a4c0-4777-b96f-d4169b5ad06b`: `SUCCESS`; public domain is `https://mindcloud-live.up.railway.app`; pre-deploy verification command is `node scripts/run-verify.js`.
- Railway frontend HTTP telemetry for the last hour: 84 requests, 72 HTTP 2xx, 12 HTTP 4xx, zero HTTP 5xx; reported 5xx error rate 0%. The 4xx responses are not automatically classified as defects; route/request context is needed.
- The production frontend-to-backend ready probe is covered by `scripts/verify-production.js`, which checks `/health`, `/ready` (including proxy verified/backend reachable), OSIRIS route, MindCloud status, Arena contract and additional endpoints.
- The end-to-end adapter test `scripts/verify-adapter-route.js` proves local authorized adapter execution, request ID, evidence-graph node creation and denial without a bearer token. Its current fixture explicitly expects `evidenceGraph.status === "in-memory"`; it does **not** prove durable production readback or frontend display. This is still the active integration gap.
- Open PR #122, `fix: make Brave two-station workspace CSP-compliant`, is draft and explicitly requires CI plus Brave installation checks before merge/deploy. Preserve the separate two-station Brave variant; the primary MindCloud workspace remains 2×2 / four stations by default.
- No evidence found in the current state/repository metadata that identifies the user-mentioned `TR6` label. Keep it unresolved rather than guessing.

## Session checkpoint — PAUSED
**Checkpoint date:** 2026-10-11
**Scope:** The Claude handover-document task is paused for later resumption. Engineering work on the existing MindCore/MindCloud runtime and adapter integration continues separately.
**Handover resume instruction:** Resume the document/Claude-project setup from this checkpoint without recreating the handover. For active engineering, follow the current milestone and next actions below.
**Last completed work in this handover session:** Added and read back `MINDCORE_MINDCLOUD_MASTER.md`, `MINDCORE_CURRENT_STATE.md`, and `CLAUDE.md` on `main`; linked them from `README.md`. No application tests or deployment verification were performed in this session.

## Adapter API failure/audit coverage — 2026-10-11
- Extended `scripts/verify-adapter-api-failure-audit.js` to exercise the same provider HTTP 503 failure path through two independently registered adapters: Graft (`build`) and OpenMontage (`plan`).
- The test now expects two provider calls, two audit entries, request IDs for both responses, and neither adapter promoted to verified after failed executions.
- Change commit: `b3435aee728049679e9cb404f7d42ffac830403e`.
- Previous commit `891b9f564f1eca71dedb79c36b23576a8dbce6dc`: MindCloud Runtime Verification passed; full MindCloud Verification including production smoke passed. New workflows for the two-adapter API test are queued and must be checked before treating this change as verified.

## Unified Build Loop progress — 2026-10-11

- User priority: complete the real MindCore/MindCloud loop; preserve the 2×2 four-station default.
- Fixed `index.html` Heritage Map routing: it no longer switches to two stations and targets hidden station 3; it preserves four stations and selects visible GEO / Heritage station 2. Added regression assertions in `scripts/verify-workspace-layout.js`.
- Bounded Overpass failover in `mindcloud/native-adapters.js`: one shared deadline across mirrors, 2.5-second per-attempt cap, 8-second health budget and 15-second execution budget. Added a stalled-upstream regression test in `scripts/verify-native-adapters.js`.
- `scripts/verify-production.js` now retries transient failures for required GET checks with endpoint-specific diagnostics. Optional Overpass health is probed once and reports an outage as a warning instead of retrying repeatedly.
- `main` has since gained deep E2E result caching with refreshed memory/browser health (`f6b7dc99`) and a test-runtime cache bypass (`ee508a85`). Those are concurrent main-branch changes; confirm deployment status before treating them as live.
- Production smoke on PR head `d96118f8` passed at 2026-10-11 02:33:40Z: `/health`, `/ready`, OSIRIS route, MindCloud API, Arena contracts, Cognee write/readback, adapter registry, and unauthenticated execution rejection. It reported `overpassStatus: healthy` and `memoryStatus: healthy`.
- On PR head `d96118f8`, MindCloud Verification, MindCloud Runtime Verification and Independent Security Contracts all passed. RuFlo MCP smoke was still running at the last check; the next docs-only commit will trigger another CI cycle.
- A previous CI failure exposed a stale assertion that expected every explicit self-test to perform a second memory write. The regression test now accepts either a fresh run or a cached result, checks persistence and verifies refreshed dependency health.
- Railway at the last check: backend deployment for `ee508a85` succeeded; frontend deployment for the same main commit was still applying, but its pre-deploy MindCloud verification suite passed. Cognee Memory, browser-use-runner and browser-chromium were online. The changes in PR #120 are not yet deployed.

## Current milestone
Establish and verify the real MindCore/MindCloud execution loop across backend and frontend, reusing the existing implementation.

## Next actions
1. Add a local regression test for the cached self-test response and overlapping calls; keep deep write/readback tests fresh under `NODE_ENV=test`.
2. Repeat the three-request self-test scenario in a controlled local test and confirm it does not launch duplicate Cognee/browser work.
3. Verify one authorized production adapter execution through request ID → evidence-graph node/readback → frontend-visible status, without exposing tokens.
4. Keep promotion gates intact: the registry has 15 `adapter-ready`, 3 `parked-cost-review`, 2 `registered-only`, 3 `research-registered`, and 1 `parked-integration-review` tools. Do not promote Speech Figure without license clearance or paid APIs without an explicit cost decision.
5. Recheck HTTP 5xx after the next normal deployment; the earlier self-test 502s were confined to a rollout window, and the subsequent cache-enabled requests returned 200.
6. Update this file with the exact evidence and remaining blocker after each meaningful change.

## Architecture decision — Regenten / Di Regenten / Formation — 2026-10-13

**Decision accepted by user:** streamline and harden MindCloud around one explicit authority/control model. This is an architecture/documentation decision in this commit; it does not yet claim a new runtime implementation.

- **Regenten:** authorized leader identity; establishes intent and mandate.
- **Di Regenten:** leadership/control function; translates intent into priorities, delegated missions, constraints, approvals and outcome review. It is not a second orchestrator.
- **Formation Engine:** owns agent roles, membership, groups/subgroups and policy-bound regrouping; it does not independently schedule task execution.
- **Dirigentverket:** remains the single execution orchestrator for the living task DAG, dependencies, retries, cancellation and task lifecycle.
- **MindCore:** shared typed state, policy, evidence, verification and operational picture; it does not grant itself unlimited authority.
- **Hivemind:** may be evaluated as a bounded planning/DAG adapter; it must not become a competing scheduler.
- **Metanoia:** contradiction/anomaly detection and revalidation; consequential changes still require policy and approval.

**Control flow:** Regenten intent/mandate → Di Regenten control → Formation assignment → Dirigentverket execution → agents/adapters → evidence/verification → MindCore shared state → leadership review and feedback.

**Hardening invariants:** server-side authorization; agent identity separated from security identity; mission scope and resource limits travel with work; client-supplied approval is never trusted; failures and missing/stale evidence cannot be promoted to verified; regrouping/retries are audited; consequential state changes retain Metanoia and human approval gates.

**Target mission contract fields:** mission/mandate/regent IDs, issuer/time, authority scope, constraints/risk/resource limits, formation and execution plan IDs, dependency/correlation IDs, approval gate, evidence/verification requirements, status/version and audit references. These are target fields to map against existing contracts—not a claim that they all exist in runtime code.

**Implementation sequence:**
1. Inventory existing task, mandate/policy, formation/agent-cluster, adapter and evidence contracts; map current coverage without duplicating components.
2. Add regression tests for scope denial, forged client approval, duplicate execution authority, retry/regroup auditability and missing evidence.
3. Implement the smallest compatible contract changes and adapter seams; preserve current 2×2 main workspace and separate two-station Brave variant.
4. Run targeted tests, then `npm run verify`; verify production separately before claiming deployment/E2E success.

**Current implementation status:** architecture documented on branch `architecture/regenten-formation-control-20261013`; runtime implementation and tests for the new model are **EJ IMPLEMENTERAT / not yet verified**. Do not describe the model as live until code and acceptance tests prove it.

## Reporting format
- **Changed:** exact files and purpose.
- **Verified:** checks actually run and results.
- **Not verified:** relevant gaps.
- **Blocker:** only a concrete obstacle.
- **Next action:** one executable step.
