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

## Reporting format
- **Changed:** exact files and purpose.
- **Verified:** checks actually run and results.
- **Not verified:** relevant gaps.
- **Blocker:** only a concrete obstacle.
- **Next action:** one executable step.


## Article milestone — The Shrine of Saint Paraskevi (2026-10-15)

- Added a standalone editorial article at `/paraskevi` and `/articles/the-shrine-of-saint-paraskevi`, with responsive layout, a locally served original SVG icon illustration, navigation from Workspace and Briefing, and source links to the Bulgarian Patriarchate, Orthodox Church in America, and Greek Orthodox Archdiocese of America.
- Historical distinction is explicit: Paraskeva/Petka of Epivates is commemorated in Bulgarian Orthodox tradition on 14 October; Paraskevi of Rome is commemorated on 26 July. The article does not conflate the two.
- Evidence layers are separated: church-calendar/hagiographic tradition, modern symbolic interpretation, and unresolved identification of any specific physical shrine.
- Added `scripts/verify-paraskevi-article.js` to the standard `npm run verify` sequence. It checks dates, identity distinction, sources, routes and navigation. This test is a regression gate; it is not considered passed until CI runs it.
- Process correction: previous handover failures were caused by relying on partial context and moving to an answer before retrieving the exact earlier discussion; another risk was treating a tool-specific request as fulfilled without confirming that the tool was available. Prevention: recover prior context first; separate similar entities and facts from interpretations; record the source and confidence for each historical claim; inspect the actual repository route/navigation; add regression checks; and never label work published, tested or deployed until the corresponding observable gate succeeds.
- Artcraft-specific status: the Artcraft integration was not available in the connected tool catalog at the time of this change. An original SVG illustration was created and included in the site; a separate cinematic concept image was generated in this conversation. Neither is represented as having been created through Artcraft.
- The article was merged in PR #131; the production-entrypoint correction was merged in PR #132. Railway production deployment `8096d08c-c9be-4f94-abe9-975554ca42f9` succeeded on commit `fc4a8df199252c217bdd7123aa1dc5ed1d7c7c12`. The production pre-deploy verification passed, including assertions against `frontend-server.js`, both article aliases, the SVG asset route, and Workspace/Briefing navigation. Direct browser rendering was not independently inspected in this tool session; do not claim visual browser QA without a real request/render check.


## Production route correction — 2026-10-15

- Root cause found during end-to-end deployment inspection: the Railway frontend service starts `frontend-server.js`, while the first article change had added the route only to backend `server.js`. The first pre-deploy test therefore checked the wrong entrypoint and gave a false-positive route guarantee.
- Corrective change: add the article aliases and SVG asset to the frontend server's explicit `STATIC_FILES` map; update the regression test to inspect `frontend-server.js` (the actual production entrypoint); remove the redundant backend-only article route.
- Verification policy strengthened: a route test must target the service's configured start command/entrypoint, not merely any source file that contains the route. Production is not considered complete until the new pre-deploy suite passes and the deployed article URL returns the expected HTML and SVG.


## Publication status — The Shrine of Saint Paraskevi — 2026-10-15

- Merged article PR #131 and corrective production-route PR #132.
- Production service `Osiris-mindcloud-ui` deployment `8096d08c-c9be-4f94-abe9-975554ca42f9` reached terminal `SUCCESS` on commit `fc4a8df199252c217bdd7123aa1dc5ed1d7c7c12`.
- Railway's pre-deploy verification output explicitly passed: article route in the actual frontend `STATIC_FILES` map, SVG route, date distinction, source links, and both navigation links; final line: `MindCloud verification suite passed.`
- A browser-based visual check of the live route was not possible through the available fetch tool, so this remains a distinct QA item rather than a claimed success.
- Root cause prevention is now encoded in `scripts/verify-paraskevi-article.js`: the test reads `frontend-server.js`, which matches the configured Railway start command `node frontend-server.js`, rather than relying on a backend-only route.


## OSIRIS station publication — 2026-10-15

- Corrected OSIRIS integration merged in PR #133; superseded/conflicting PR #130 was closed.
- The primary Workspace remains four stations in a 2×2 grid by default. Station 4 now embeds the existing `https://osirisai.live/` site, with independent reload and an `OPEN STANDALONE` fallback if framing is blocked. Selecting two-station mode shows MindCore + OSIRIS.
- The production frontend test now verifies the actual OSIRIS iframe, reload control, standalone fallback, four-station default, and two-station selection.
- Latest Railway production deployment `915d35c4-110e-4d7b-a9d2-9c4878d94270` reached `SUCCESS` on commit `3a764bd981a44e760d5020b519de168324d1c98c`. Its pre-deploy verification passed the article route/source/date checks and OSIRIS quadrant checks; final line was `MindCloud verification suite passed.`
- Remaining limitation: iframe rendering of `osirisai.live` itself has not been confirmed in a real user browser; the standalone fallback is provided because the external site may restrict framing.
- Artcraft was not available in the connected plugin catalog for the Paraskevi article. The published page uses an original locally served SVG illustration; a separate concept image was generated in-chat, and neither is mislabelled as Artcraft output.
