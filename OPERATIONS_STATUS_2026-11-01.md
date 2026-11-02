# Operations snapshot — 2026-11-01

## Scope and priority
This snapshot reconciles the live GitHub repository and Railway environment on 2026-11-01. It records observed state, not assumed functionality.

User-defined system priority:
1. MindCore
2. MindCloud
3. Dirigentverket
4. Metanoia Engine
5. Evidence / Evidence Passport
6. Capability Registry
7. Workstation
8. OSIRIS (client and testbed)

## GitHub repository observed
- Repository: `selotisk-source/Osiris-mindcloud-ui`
- Default branch: `main`
- GitHub integration reports admin/push access.
- README describes MindCore as owner of typed state, task graphs, capability routing, lifecycle, policy and verification; OSIRIS is a client/testbed.
- Latest commit returned by the repository's recent-commit query: `b16dfda405d19c3a91814ac9fc8b157dadc8243f` (2026-11-01, this operations snapshot link).
- Existing branches include `mindcloud/unified-ruflo-osiris-v5`, `feat/mindcloud-ruflo-bridge`, `mindcloud/metanoia-engine-v1`, `mindcloud/evidence-graph-v1`, and multiple runtime/evidence/security work branches. Branch existence does not mean merged or deployed.
- `package.json` defines a broad `npm run verify` sequence covering The Joint, Recursive Trace, security gates, adapter persistence E2E, runtime, provider network, workspace, OSIRIS and research routes.
- `scripts/verify-adapter-persistence-e2e.js` exists. Its test contract starts a provider stub, executes an authorized adapter over HTTP, asserts evidence is written to disk, restarts the backend, and reads the same node through the frontend proxy. The script was inspected from GitHub; it was NOT executed in this session.
- GitHub Actions runs queried for the latest pre-snapshot commit returned an empty list. This is not evidence that all workflows are absent or that earlier runs failed/passed.

## RuFlo bridge branch inspection
- Compared `mindcloud/unified-ruflo-osiris-v5` against `main`: branch is diverged, 7 commits ahead and 398 behind; it is not a safe direct merge candidate.
- Inspected bridge files on that branch. `task-contract.ts` defines typed task/evidence interfaces; `ruflo-adapter.ts` only delegates to an injected `RufloTransport` interface. No concrete transport/client implementation is present in the inspected file.
- The branch smoke script starts `npx ruflo@latest mcp start`, performs MCP initialize and `tools/list`, and checks that at least one tool is discovered. It does not execute a tool via `tools/call`, nor does it pass a MindCloud task through the bridge.
- Therefore the branch documents a contract and basic MCP discovery smoke, but it does NOT establish a functioning MindCore → Dirigentverket → RuFlo execution path. Reconcile the small bridge changes onto current main, implement a real bounded transport and read-only execution, then test result/evidence handling before any production promotion.

## Railway production state observed 2026-11-01
Project: `lively-nurturing`
Environment: `production`

All five registered services are currently `offline`, with no active deployments:
- `Osiris-mindcloud-ui`
- `mindcloud-osiris`
- `Cognee Memory`
- `browser-use-runner`
- `browser-chromium`

Railway reports no pending work. The three persistent services (backend, Cognee, browser-use-runner) still report attached volumes. The environment has zero active deployments and no pending staged changes.

The earlier 2026-10-28 state record documented Railway rejecting reconnect/deploy with an expired-trial message. The current Railway query confirms offline services; it does not establish whether billing has since changed. No service was restarted, redeployed, or reconfigured in this session.

## Hosting migration
The repository contains Cloudflare Pages + Render preparation:
- `scripts/build-pages.js` and `npm run build:pages`
- `functions/api/[[path]].js` Pages Function proxy
- `render.yaml`
- `CLOUDFLARE_RENDER_DEPLOY.md`

The previous state record says the Pages project and Render service had not been created/deployed, and the Pages-to-Render API flow had not been runtime-tested. No live Pages/Render project was inspected in this session, so migration remains NOT CONFIRMED as deployed.

## Engineering state and next executable sequence
1. Restore an active production host. Railway is presently offline; the earlier account-side trial-expiry issue needs resolution, or the prepared Cloudflare Pages + Render route must be provisioned.
2. Once a runtime is available, run the full `npm run verify` sequence from a clean checkout; first run the focused `node scripts/verify-adapter-persistence-e2e.js`.
3. Verify the complete authorized request → real adapter → persisted evidence → backend restart/readback → frontend proxy flow in a running environment.
4. Reconcile the RuFlo bridge branch against current `main` without merging its 398-commit divergence; implement an actual MCP transport and a read-only `tools/call` test.
5. Connect Dirigentverket task lifecycle and typed contracts to the actual runtime; preserve separation between analysis and side effects.
6. Run Metanoia revalidation before any consequential model/registry promotion; preserve human approval gates.
7. Update this file after each observed code, test, or deployment change.

## Explicit status distinctions
- Repository and files: inspected via GitHub API.
- Test source: inspected; not run here.
- RuFlo bridge: contract and discovery smoke inspected; real task execution not established.
- Railway service state: queried; all five offline.
- Production runtime/API: unavailable for end-to-end checks while services are offline.
- Cloudflare Pages / Render migration: preparation files exist; live deployment not confirmed.
- No code was deployed or any service restarted in this session.


## Render migration work — 2026-11-02

- Created Render web service `mindcloud-backend` from `main`, Frankfurt, free plan, start command `node server.js`, with `NODE_ENV=production` and `MINDCLOUD_API_ONLY=true`.
- Backend deploy `dep-dbjv7fajnfac7394t10g` reached Render status `live` on commit `32cf7ca9cda06398a6bd15dbbf062a482ebda693`. Startup log reports `OSIRIS MindCloud listening on port 10000` and Render reports the primary URL `https://mindcloud-backend.onrender.com`.
- Created Render web service `mindcloud-frontend` from `main`, Frankfurt, free plan, start command `node frontend-server.js`, configured with `MINDCLOUD_BACKEND_URL=https://mindcloud-backend.onrender.com`.
- Initial frontend deployment failed at process startup because the `STATIC_FILES` object in `frontend-server.js` contained literal escaped newline sequences. Fixed the source block and committed `f42196d4d8a17d9950bc94a32eb45b2a2e663e4e`.
- Frontend deploy `dep-dbjva867bikc738lqivg` reached Render status `live`; startup log reports `MindCloud frontend listening on port 10000` and Render reports `https://mindcloud-frontend.onrender.com`.
- Backend startup self-test status was `degraded`, not passed: core routing/catalog checks passed, but durable store paths were not configured, Cognee was not configured, Browser Use lacked `BROWSER_USE_SERVICE_URL` and `BROWSER_USE_API_KEY`, and the Overpass probe timed out. These are separate integration/persistence gaps, not a frontend syntax failure.
- Direct HTTP checks of the public Render URLs could not be completed from the current execution environment (DNS resolution unavailable). Render deployment status and startup logs are observed; public route responses and frontend-to-backend `/ready` remain unconfirmed.
- The current main-branch tree contains only three dedicated research/article HTML pages: `sofia-research.html`, `varna-sofia-cyprus.html`, and `paraskevi.html`. `research/ARTICLE_SERIES_EVIDENCE_LEDGER.md` is a research ledger, not an eight-article-per-program catalogue. Do not fabricate missing programs or article entries. Recover the user's full programme/article source before building that portal.
- Railway has not been shut down or modified. Keep it intact until the Render public routes and critical workflows are tested end-to-end.
