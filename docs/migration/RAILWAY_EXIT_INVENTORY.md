# Railway exit inventory — 2026-11-01

## Scope and evidence
Inventory read from Railway project `lively-nurturing`, production environment, on 2026-11-01. This document records configuration and the latest deployment records returned by Railway. A service marked `live` means its configuration exists; it does not mean its process is healthy.

## Production services

| Service | Source | Start/build | Latest deployment | Persistent storage |
|---|---|---|---|---|
| Osiris-mindcloud-ui | selotisk-source/Osiris-mindcloud-ui | `node frontend-server.js`; Railpack; pre-deploy `node scripts/run-verify.js`; health `/ready`; port 8080 | FAILED, 2026-10-12 | none |
| mindcloud-osiris | same repository | `node server.js`; Railpack; health `/health`; private endpoint `mindcore-api` | no deployment recorded | `mindcloud-runtime-data`, 500 MB at `/data` |
| Cognee Memory | same repository | Dockerfile `deploy/cognee/Dockerfile`; health `/health`; 2 CPU / 1 GB override | FAILED, 2026-10-10 | `cognee-persistent-data`, 500 MB at `/data` |
| browser-use-runner | image `ghcr.io/railwayapp/function-bun:1.4.0` | embedded Bun/Playwright runner; uses Chromium CDP | no deployment recorded | `browser-session-data`, 500 MB at `/data` |
| browser-chromium | image `browserless/chrome:latest` | Browserless Chrome; token-protected | no deployment recorded | none |

A Railway bucket named `domedagsprofeten-media` exists in region `ams`. Its contents and consumers have not yet been inspected.

## Inter-service configuration
- Frontend uses `MINDCLOUD_BACKEND_URL`, `COGNEE_SERVICE_URL`, `BROWSER_USE_SERVICE_URL`, and CCTV-related settings.
- Backend exposes a private Railway endpoint `mindcore-api`; it uses Cognee and browser-related configuration.
- Browser runner connects to Chromium over CDP and stores session metadata in `/data/browser-sessions.json`.
- Do not copy secret values into this document. Variable names observed on services are retained in Railway configuration; values must be transferred through the destination platform's secret manager.

## Confirmed failure evidence
1. Frontend deployment `a48f1182-3d50-406d-8074-e96819bce7ca` failed at stage `PRE_DEPLOY_COMMAND`, with failure text `Pre-deploy command failed`. The pre-deploy command is `node scripts/run-verify.js`. Build completed and produced an image. The exact failing test has not yet been isolated from the returned log excerpt.
2. Cognee deployment `be6faf89-f838-4777-a1a1-cb0f37fb6a60` failed at `HEALTHCHECK`. Railway repeatedly received service unavailable from `/health` for five minutes; no replica became healthy. The build itself completed. The current entrypoint is Railway-specific: `deploy/cognee/railway-entrypoint.sh`, including volume ownership assumptions and patching `/app/.env`.

## Existing destination configuration
The repository's current `render.yaml` defines only one free Node web service called `mindcloud-backend`, with `npm install`, `node server.js`, and `/health`. It does not define the frontend, Cognee Docker service, browser runner, Chromium, persistent disks, bucket/object storage, or service-to-service secrets. It is not a complete migration configuration and should not be deployed as the whole system.

## Migration blockers / required work
1. Identify the exact failing assertion in frontend pre-deploy verification and separate required production checks from tests that cannot run during build.
2. Make Cognee startup platform-neutral; explicitly map writable persistent paths and ensure the upstream process binds to the platform-provided port/interface.
3. Select destination hosting only after confirming persistent disk semantics, Docker support, private networking, resource requirements, and object storage for the media bucket. Do not assume a free tier is sufficient.
4. Export and validate data from all three volumes and inventory the media bucket before any cutover. Preserve originals until destination restore is tested.
5. Capture variable *names* and required service mappings; move secret values securely, never into Git.
6. Deploy destination services in parallel with Railway, test health/readiness and end-to-end flows, then cut traffic only after tests pass.

## Safety
No Railway service, volume, bucket, domain, or production traffic was changed by this inventory. No data was copied or restored. No destination service has been deployed.


## Follow-up findings — 2026-11-01

### Frontend pre-deploy failure isolated
The instrumented verification suite identified the first failing command as scripts/verify-the-joint.js, line 20. The assertion expected needs_reconciliation, but the implementation returned joined_pending_validation. Root cause: mindcore/the-joint.js checked for exact wording matches and continued before checking for contradictory claims about the same subject. An exact matching claim therefore masked a second, opposing claim.

Fix committed on the migration branch: contradiction detection now runs before the exact-match early return, so shared wording and unresolved opposing claims are both retained.

### CI results after fix
- Migration branch checks run #7: SUCCESS. All project verification commands passed, and both Cognee entrypoint shell syntax checks passed.
- MindCloud Runtime Verification run #610: SUCCESS.
- Previous runs before the fix failed on the exact assertion described above.
- Brave extension and RuFlo smoke tests were still running at the time of this update; no result claimed for those jobs.

### Additional migration preparation
- Added deploy/cognee/platform-entrypoint.sh and deploy/cognee/Dockerfile.platform. Existing Railway startup files remain unchanged.
- Added a Render assessment. Render supports Docker services, private networking, and paid persistent disks. Its published disk price is USD $0.25/GB-month; compute and data requirements still need sizing.
- Draft pull request: https://github.com/selotisk-source/Osiris-mindcloud-ui/pull/148

The fix is validated by GitHub Actions on the migration branch. It has not been merged to main or deployed to Railway. Cognee's live /health failure has not yet been reproduced against the destination container. No production data has been moved.
