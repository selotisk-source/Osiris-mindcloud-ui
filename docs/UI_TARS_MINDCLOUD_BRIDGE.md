# UI-TARS bridge — MindCloud integration contract

## Purpose

Expose UI-TARS Desktop / its SDK as a supervised GUI execution capability. MindCore remains the authority for task routing, approval, evidence and audit. The UI-TARS worker is an execution surface only.

Official upstream: https://github.com/bytedance/UI-TARS-desktop  
SDK guide: https://github.com/bytedance/UI-TARS-desktop/blob/main/docs/sdk.md

The upstream repository was archived on 2026-11-09. Do not blindly follow its moving `main` branch or auto-install an unpinned dependency. Pin a reviewed release/commit or maintain a reviewed fork before building the worker image.

## Topology

`MindCore → AdapterRuntime → authenticated Railway bridge → isolated UI-TARS worker → approved desktop/browser profile`

Railway hosts the control/bridge service. The GUI operator must run in an environment that actually owns the target desktop/browser session; a headless Railway API container must not be represented as a user's local desktop.

## MindCloud adapter

- Adapter ID: `ui-tars`
- Endpoint: `UI_TARS_SERVICE_URL`
- Secret: `UI_TARS_API_KEY` (Bearer token)
- Health: `GET /health`
- Execution: `POST /execute`
- Request: `{ requestId, operation, input }`
- Response: JSON; preserve `requestId` and return a stable `run_id` for asynchronous work.

Supported operations: `health`, `capabilities`, `run`, `status`, `cancel`, `screenshot`.

Typed input:
- `run`: `task` required; optional `session_id`, `max_steps`, `metadata`.
- `status` / `cancel`: `run_id` required.
- `screenshot`: `session_id` required.
- `capabilities`: no input required.

All GUI operations pass through MindCloud's human approval gate. The bridge must independently authenticate MindCloud, validate operation allowlists, bind every run to an isolated profile, cap execution time/steps, redact secrets from logs, and reject arbitrary shell/process execution. A browser or desktop action must never inherit MindCore or Railway control-plane credentials.

## Deployment configuration

Set `UI_TARS_SERVICE_URL` to the private Railway service URL and `UI_TARS_API_KEY` as a Railway secret. Do not expose the bridge publicly without TLS, bearer authentication, host/origin restrictions and network policy. Keep the worker disabled until its /health contract and authenticated run lifecycle are exercised end-to-end.

No UI-TARS worker, Railway service, volume, secret or production deployment is created by this repository adapter change alone.
