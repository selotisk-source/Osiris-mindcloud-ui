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
- Frontend Railway deployment `08168b83-6575-437e-9c4a-428e65a5c233` completed successfully from `main` commit `228feaab20b45fc5fe12f8c7d44c55d2d428c25d`.
- Backend Railway deployment `27862fd5-15f1-4979-8ab8-782dd082fd9e` completed successfully with the single-flight self-test change from commit `6e065ce9c1845d222b110497ae867eac84cd87b7`.
- The frontend pre-deploy command completed `node scripts/run-verify.js` with the explicit result `MindCloud verification suite passed.` This included Arena, adapter contracts and failure audit, Speech Figure promotion gate, four-station workspace layout, provider-network, agent-cluster and OSIRIS console checks.
- Backend startup self-test logged `status: passed`: all four core checks passed, Cognee health and write/readback persistence passed, and Browser Use executed successfully with HTTP 200.
- Post-deploy frontend smoke requests returned HTTP 200 for `/health`, `/ready`, `/osiris`, `/api/mindcloud/status`, valid Arena evaluation, `/api/adapters`, `/api/agent-tools` and `/api/cctv`. Invalid Arena input returned the expected 400; unauthorized Metanoia approval and adapter execution returned the expected 401.
- The shared self-test promise is implemented in `server.js` and both startup and the API route use it.

## Still not verified
- Three simultaneous production `POST /api/mindcloud/selftest` requests returned 502 during frontend rollout with upstream connection-closed/refused errors. The frontend deployment subsequently passed its smoke checks and is online, but this self-test failure mode has not yet been retested against a stable deployment.
- The complete production backend → authorized adapter execution → persisted evidence/state → frontend display flow has not been verified as one transaction.
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
