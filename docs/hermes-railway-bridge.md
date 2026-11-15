# Hermes Agent — Railway Bridge

## Architecture

MindCore remains the policy, routing, approval and evidence authority. Hermes Agent runs as a separate Railway service and is reached only through Railway private networking.

- MindCore → Hermes API server: private HTTP
- Hermes API authentication: dedicated bearer key
- Hermes operations are exposed through the existing supervised AdapterRuntime
- Run submission, stop and approval require a MindCloud approval ticket
- Status and capability reads are read-only
- Successful adapter responses are attached to the MindCloud Evidence Graph as observations, not promoted claims

## MindCloud backend variables

Set on the `mindcloud-osiris` Railway service:

- `HERMES_SERVICE_URL=http://hermes-agent.railway.internal:8642`
- `HERMES_API_KEY=<same secret as Hermes API_SERVER_KEY>`

Do not set these variables on the public frontend service.

## Hermes service variables

Set on the separate `hermes-agent` Railway service:

- `API_SERVER_ENABLED=true`
- `API_SERVER_HOST=0.0.0.0`
- `API_SERVER_PORT=8642`
- `API_SERVER_KEY=<strong randomly generated secret>`
- `HERMES_HOME=/opt/data` (persistent volume mounted at `/opt/data`, matching the official image)
- `PYTHONUNBUFFERED=1`

Hermes also needs an explicitly configured model provider and any required tool backends. Provider credentials belong only on the Hermes service. The API server can expose powerful agent tools, including terminal and file operations. Before enabling task execution, disable terminal and file toolsets for the `api_server` platform (for example, as Railway pre-deploy commands: `hermes tools disable terminal --platform api_server` and `hermes tools disable file --platform api_server`). Keep the service private, then selectively enable only the toolsets MindCloud needs. Do not expose a public domain or broad CORS origins.

## Adapter contract

- `health`: liveness probe (`/health` is public in Hermes; the adapter still sends its bearer key)
- `capabilities`: read-only feature discovery
- `submit_run`: create a Hermes run; approval required; uses an idempotency key
- `get_run`: read run status
- `stop_run`: interrupt a run; approval required
- `approve_run`: resolve a pending Hermes approval; approval required

## Rollout and acceptance

1. Deploy the official `nousresearch/hermes-agent` image as a separate Railway service, with start command `gateway` and a persistent volume mounted at `/opt/data`.
2. Configure a model provider and a restricted toolset; keep API_SERVER_KEY private.
3. Configure the two matching secrets/URLs on the backend and Hermes services.
4. Confirm the Hermes `/health` endpoint over Railway private networking.
5. Run `node scripts/verify-hermes-bridge.js`.
6. Run the full `npm run verify` suite.
7. Exercise one approved run from MindCloud, poll it to a terminal state, and confirm its result is linked to an Evidence Graph observation.

A successful build or health response alone does not establish end-to-end integration.
