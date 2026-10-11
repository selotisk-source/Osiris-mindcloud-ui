# MindCore / MindCloud — Current State
**Last reconciled:** 2026-10-11  
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
- `server.js` coalesces overlapping deep self-tests and caches the last deep result for six hours while refreshing Cognee and Browser Use health. Cache-enabled production self-test requests returned HTTP 200 in 49 ms and 55 ms.
- The cache initially caused the Cognee test-mode verifier to reuse the startup result. This was corrected so `NODE_ENV=test` bypasses the cache; the complete verification suite then passed on the latest frontend deployment.
- Latest environment status: all five services online, no pending work, and no current service failures. The frontend has one historical failed deployment from the intermediate cache/test mismatch; the subsequent deployment succeeded.

## Still not verified
- Three simultaneous production `POST /api/mindcloud/selftest` requests returned 502 during an earlier rollout with upstream connection-closed/refused errors. Cache-enabled requests subsequently returned quickly and the latest deployments are healthy, but a controlled repeat of the exact three-request scenario has not been completed.
- The complete production backend → authorized adapter execution → persisted evidence/state → frontend display flow has not been verified as one transaction, although the local adapter-route suite verifies adapter output linked to evidence-graph nodes.
- Not every README-listed adapter has been proven executable in production; some correctly remain credential-gated or research-only.
- GitHub commit-status API returned no status checks for the inspected commits; the Railway pre-deploy verification is the observed green suite.

Do not silently convert these items into “working” status without fresh evidence.

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
1. Inspect repository tree, package scripts, current commits and CI status.
2. Run the repository’s prescribed verification command (`npm run verify`, after checking scripts and environment).
3. Identify the highest-impact failing or missing link in task intake → orchestration → adapter execution → evidence/state persistence → frontend display.
4. Fix the smallest reproducible issue and add/update a regression test.
5. Verify the result; check deployment separately from local/CI verification.
6. Update this file with exact evidence and the next remaining blocker.

## Reporting format
- **Changed:** exact files and purpose.
- **Verified:** checks actually run and results.
- **Not verified:** relevant gaps.
- **Blocker:** only a concrete obstacle.
- **Next action:** one executable step.
