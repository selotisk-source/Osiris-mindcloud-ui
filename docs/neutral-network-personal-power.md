# Neutral Network: Personal Power integration

## User-facing visualization

- Frontend route: `/personal-power`
- MindCloud Workspace navigation: **Personal Power / Neutral Network**
- Backend graph endpoint: `GET /api/neutral-network/personal-power`
- Graph schema: `mindcloud.neutral-network.graph.v1`

The page fetches the typed graph from the MindCore backend and renders interactive category and concept nodes. Selecting a node shows its source ID, type, confidence, epistemic status and provenance. The page also explains the processing pipeline and distinguishes implemented API wiring from persistence and validation.

## Security

The graph endpoint is protected by the existing MindCloud execution authorization by default. Anonymous access is only enabled if the deployment explicitly sets `MINDCLOUD_PERSONAL_POWER_PUBLIC=true`. The content is personal, so public exposure must be a deliberate deployment decision. The UI does not store or ask the user to paste an execution token.

## Data contract and epistemic boundaries

- Nodes and edges retain source provenance.
- Low/medium confidence labels preserve uncertain transcription.
- Every node remains `verified: false`; graph status is `ingestion_preview`.
- Visible layout edges are not semantic/causal assertions.
- Claim is not evidence; evidence is not validation.
- No psychological/medical assessment or efficacy inference is generated.
- No automatic promotion or production Evidence Graph write is performed.

## Verification

Run `npm run verify`. The standard suite includes:
- `scripts/verify-neutral-network-personal-power.js` — graph schema and provenance.
- `scripts/verify-neutral-network-personal-power-ui.js` — frontend route, backend endpoint, navigation, authorization and graph visualization wiring.

CI execution and production browser/API verification are required before describing the integration as deployed and end-to-end verified.
