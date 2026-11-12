# MindCloud migration execution — 2026-10-31

## Destination selected from existing project decision

The repository already specifies **Cloudflare Pages for the frontend + Render for the Node API** in `CLOUDFLARE_RENDER_DEPLOY.md`. This is the migration target used by this execution branch; no new hosting provider or paid service is being purchased here.

## Current repository facts

- Cloudflare Pages build command: `npm run build:pages`; output: `dist`.
- The build script copies the static UI pages, assets and newsletters and writes route rewrites.
- `functions/api/[[path]].js` already proxies same-origin `/api/*` requests to `MINDCLOUD_BACKEND_URL`.
- `render.yaml` currently defines only one Render web service, `mindcloud-backend`, using `node server.js`, `MINDCLOUD_API_ONLY=true`, and `plan: free`.
- `deploy/cognee/Dockerfile` and `railway-entrypoint.sh` are Railway-specific. They must not be used unchanged on the new platform.
- The architecture document still describes Railway private networking and the Railway-only frontend proxy. That document is stale relative to the Cloudflare/Render deployment guide.
- The Render blueprint does **not** yet define Cognee, Browser Use runner, Chromium, durable data services, or persistent storage.

## Critical production constraints

1. Render free web services sleep after 15 minutes without inbound traffic, take about a minute to wake, and lose local filesystem changes on restart/redeploy/spin-down. Free web services cannot attach persistent disks. They are suitable for a temporary smoke test only, not authoritative MindCore/MindCloud production.
2. Render persistent disks are available on paid services and currently priced at $0.25/GB/month. The correct size and compute plan must be chosen after measuring Cognee data, model/cache footprint and service memory. No paid resource is provisioned by this change.
3. The backend currently holds some approvals, audit and report state in process memory (for example Maps in `server.js`). A disk alone does not make those Maps durable. These records need an explicit durable datastore and restart/readback tests before production cutover.
4. Cloudflare Pages Functions are billed against Workers request quotas. Static asset requests are free; function/API traffic must be checked against the account's current quota and usage.
5. Railway data volumes must be backed up and restored into the destination before any Railway service or volume is removed.

## Execution sequence and acceptance gates

### A. Frontend — Cloudflare Pages
- Connect `selotisk-source/Osiris-mindcloud-ui`, production branch `main`.
- Build: `npm run build:pages`; output: `dist`; Functions directory: `functions/`.
- Configure server-side Pages variable `MINDCLOUD_BACKEND_URL` to the Render API origin (HTTPS, no trailing slash).
- Acceptance: homepage and `/paraskevi`, `/varna-sofia-cyprus`, `/sofia-research`, `/ipo` return expected pages; `/api/mindcloud/status` proxies valid JSON.

### B. Node API — Render
- Deploy the repository blueprint as a **temporary test instance only** until its free plan is replaced with a continuously available paid plan and durable state is designed.
- Configure `NODE_ENV=production`, `MINDCLOUD_API_ONLY=true`, health path `/health`, and required secrets only in Render's secret environment.
- Acceptance: `/health` returns HTTP 200; authenticated API calls and authorization-denial paths behave as expected; backend-to-frontend API round-trip succeeds.

### C. Cognee memory
- Use the new `deploy/cognee/Dockerfile.portable` and `deploy/cognee/portable-entrypoint.sh`; the Railway-specific image remains untouched for rollback.\n- Build and run the portable image against a test volume before creating the Render Cognee service.
- Use a dedicated persistent mount for Cognee data and model caches; preserve UID/GID and non-root execution.
- Back up Railway volume contents, restore to the new mount, then run memory health and write/readback tests against known test records.
- Acceptance: memory survives service restart and redeploy; no production memory is declared migrated based on health alone.

### D. Browser execution
- Inventory and deploy Browser Use runner and Chromium as separate private services/containers.
- Keep browser credentials and execution tokens server-side; only MindCore API may call these services.
- Acceptance: authorized browser job executes and returns evidence; unauthorized request is denied.

### E. Durable state and cutover
- Replace process-local approval/audit/evidence state with a durable store or prove the relevant state is intentionally ephemeral by contract.
- Back up every Railway volume and database; restore and compare counts/checksums.
- Run `npm run verify`, then production health, authenticated API round-trip, memory persistence, browser execution, evidence readback and frontend display.
- Switch DNS/public traffic only after all gates pass. Keep Railway intact as rollback until the new path passes end-to-end checks.

## Checks observed on the migration branch

- `sh -n deploy/cognee/portable-entrypoint.sh`: passed in the working shell.
- GitHub Actions `MindCloud Runtime Verification`: failed on the current PR head at `scripts/verify-the-joint.js:20`. Actual state was `joined_pending_validation`; assertion expected `needs_reconciliation`. The workflow stopped at this first assertion, so the rest of `npm run verify` did not run.
- The Cognee Docker image has **not** been built or run. Shell syntax alone does not prove compatibility with the upstream image or a Render-mounted volume.

## Current status

- [x] Existing target decision found in repository: Cloudflare Pages + Render.
- [x] Existing Pages build/proxy implementation and Render blueprint inspected.
- [x] Unsafe limitation in current Render blueprint identified: free compute, no persistent disk, only Node API service.
- [ ] Cloudflare Pages account/project connected and deployed.
- [ ] Render backend provisioned and health-tested.
- [x] Platform-neutral Cognee Dockerfile and startup entrypoint added; shell syntax check passed. Image build and runtime are not yet tested.\n- [ ] Cognee persistent data migration and restart/readback test.
- [ ] Browser Use runner and Chromium migrated.
- [ ] Durable backend state implemented and tested.
- [ ] Full end-to-end acceptance and public cutover.

## Official platform references checked 2026-10-31

- Render free-instance limits: https://render.com/docs/free
- Render persistent disks: https://render.com/docs/disks
- Render pricing: https://render.com/pricing
- Cloudflare Pages Functions pricing/limits: https://developers.cloudflare.com/pages/functions/pricing/

**Truthful completion rule:** this branch records the target and execution gates. It does not claim that any external account has been connected, any service has been deployed, or any Railway data has been copied.
