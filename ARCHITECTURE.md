# MindCloud application architecture

## Runtime boundary

### Frontend — `Osiris-mindcloud-ui`
- Entry point: `frontend-server.js`
- Owns HTML delivery and browser-facing routes only.
- Proxies `/api/*` and `/newsletters/*` to the backend over Railway's private network.
- Must not hold model-provider, execution, approval, CCTV, or memory credentials.
- Health: `GET /health`.

### Backend — `mindcloud-osiris` / MindCore API
- Entry point: `server.js` with `MINDCLOUD_API_ONLY=true`.
- Owns API routes, policy and approval gates, tool/agent execution, Metanoia, evidence, CCTV proxy, and memory integration.
- Secrets remain backend-side.
- Health: `GET /health`; API routes are under `/api/*`.
- Internal Railway endpoint: `mindcore-api.railway.internal:8080`.

### Internal dependencies
- Cognee Memory: private service `cognee-memory`; reached only by backend.
- Browser Use runner and Chromium: execution services reached only by backend.
- No browser code calls these services directly.

## Request path

`Browser → Frontend → private Railway proxy → MindCore API → authorized internal adapter/service`

The frontend proxy preserves same-origin browser requests, so existing `fetch('/api/...')` calls remain valid. It does not add credentials or bypass backend authorization.

## Required frontend configuration
- `PORT=8080`
- `MINDCLOUD_BACKEND_URL=http://mindcore-api.railway.internal:8080`

## Required backend configuration
- `PORT=8080`
- `MINDCLOUD_API_ONLY=true`
- Set the backend's existing secrets and integration URLs on the backend service. Do not copy secret values into frontend variables.
- Private networking endpoint name: `mindcore-api`.

## Rollout order
1. Deploy API-only backend and verify health plus API contracts while the current UI remains live.
2. Confirm backend environment variables and private dependency access.
3. Deploy frontend server with private backend URL and verify health, proxied API calls, CCTV metadata, and browser execution.
4. Only then switch the public UI service start command to `node frontend-server.js`.
5. Keep the current known-good deployment available for rollback until end-to-end checks pass.

## Truthful status rule
A successful image build is not application verification. Acceptance requires frontend health, backend health, authenticated API round-trip, memory integration check, adapter execution readback, and CCTV stream/frame verification where a source is configured.
