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
- Latest commit returned by the repository's recent-commit query: `3efbda1e6962923d6457c9dad7619e88fe996971` (2026-10-28, article-series evidence research).
- Existing branches include `mindcloud/unified-ruflo-osiris-v5`, `feat/mindcloud-ruflo-bridge`, `mindcloud/metanoia-engine-v1`, `mindcloud/evidence-graph-v1`, and multiple runtime/evidence/security work branches. Branch existence does not mean merged or deployed.
- `package.json` defines a broad `npm run verify` sequence covering The Joint, Recursive Trace, security gates, adapter persistence E2E, runtime, provider network, workspace, OSIRIS and research routes.
- `scripts/verify-adapter-persistence-e2e.js` exists. Its test contract starts a provider stub, executes an authorized adapter over HTTP, asserts evidence is written to disk, restarts the backend, and reads the same node through the frontend proxy. The script was inspected from GitHub; it was NOT executed in this session.
- GitHub Actions runs queried for the latest observed commit returned an empty list. This is not evidence that all workflows are absent or that earlier runs failed/passed.

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

This supersedes the earlier 2026-10-28 snapshot only for current observed service state. The previous recorded blocker was Railway's expired trial message when attempting to reconnect/deploy. The current Railway query confirms offline services; it does not establish whether billing has since changed. No service was restarted, redeployed, or reconfigured in this session.

## Hosting migration
The repository contains Cloudflare Pages + Render preparation:
- `scripts/build-pages.js` and `npm run build:pages`
- `functions/api/[[path]].js` Pages Function proxy
- `render.yaml`
- `CLOUDFLARE_RENDER_DEPLOY.md`

The previous state record says the Pages project and Render service had not been created/deployed, and the Pages-to-Render API flow had not been runtime-tested. No live Pages/Render project was inspected in this session, so migration remains NOT CONFIRMED as deployed.

## Engineering state and next executable sequence
1. Restore an active production host. Railway is presently offline; the prior recorded trial-expiry blocker needs an account-side resolution, or the prepared Cloudflare Pages + Render route must be provisioned.
2. Once a runtime is available, run the full `npm run verify` sequence from a clean checkout; first run the focused `node scripts/verify-adapter-persistence-e2e.js`.
3. Verify the complete authorized request → real adapter → persisted evidence → backend restart/readback → frontend proxy flow in a running environment.
4. Reconcile the RuFlo bridge branches against `main`; branch presence alone is not completion. Confirm MCP startup and a read-only task before connecting write-capable execution.
5. Connect Dirigentverket task lifecycle and typed contracts to the actual runtime; preserve separation between analysis and side effects.
6. Run Metanoia revalidation before any consequential model/registry promotion; preserve human approval gates.
7. Update this file after each observed code, test, or deployment change.

## Explicit status distinctions
- Repository and files: inspected via GitHub API.
- Test source: inspected; not run here.
- Railway service state: queried; all five offline.
- Production runtime/API: unavailable for end-to-end checks while services are offline.
- Cloudflare Pages / Render migration: preparation files exist; live deployment not confirmed.
- No code was deployed or any service restarted in this session.
