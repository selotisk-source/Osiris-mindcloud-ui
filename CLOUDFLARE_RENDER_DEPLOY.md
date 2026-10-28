# MindCloud deployment: Cloudflare Pages + Render

## Cloudflare Pages frontend

Connect repository `selotisk-source/Osiris-mindcloud-ui` to Cloudflare Pages.

- Production branch: `main`
- Build command: `npm run build:pages`
- Build output directory: `dist`
- Root directory: repository root
- Pages Functions directory: `functions/` (at repository root)

Add the Pages environment variable:

- `MINDCLOUD_BACKEND_URL`: the public HTTPS origin of the Render backend, without a trailing slash.

The Pages Function under `functions/api/[[path]].js` proxies same-origin `/api/*` calls to Render. Do not put API tokens in frontend environment variables or HTML.

## Render backend

Create a new Web Service from the same repository and use the checked-in `render.yaml` blueprint, or configure:

- Build command: `npm install`
- Start command: `node server.js`
- Health check path: `/health`
- Environment: `NODE_ENV=production`, `MINDCLOUD_API_ONLY=true`

After Render provides the service URL, set it as `MINDCLOUD_BACKEND_URL` in Cloudflare Pages, then trigger a new Pages deployment.

## Secrets and persistence

Set only the server-side secrets actually required by the chosen features in the Render dashboard, never in GitHub or Cloudflare's public build variables. Review `MINDCORE_CURRENT_STATE.md` and the existing integration contracts before configuring external services.

Render's free service may sleep after inactivity and its local filesystem is not durable. Do not assume in-memory approvals, event state, evidence graph data, or any local files survive restarts. Configure durable storage before relying on persistent production state.

## Acceptance checks

1. Pages homepage returns HTTP 200 and renders the intended planetary landing page.
2. `/paraskevi`, `/varna-sofia-cyprus`, `/sofia-research`, and `/ipo` return the expected pages.
3. `/api/mindcloud/status` returns valid JSON through the Pages Function.
4. `/health` on Render returns HTTP 200.
5. Run the repository's `npm run verify` suite in a checkout and resolve failures before calling the migration complete.
