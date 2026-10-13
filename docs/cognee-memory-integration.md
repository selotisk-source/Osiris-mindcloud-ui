# Cognee Memory Integration

Cognee is registered as the **knowledge-memory layer** for MindCloud.

Cognee's current open-source architecture combines graph and vector retrieval and supports persistent agent memory, session-aware memory, feedback/improvement flows and multimodal/data ingestion.

## MindCloud role

Cognee should sit behind a typed capability boundary rather than becoming the MindCore kernel:

`Sources → Cognee memory/graph → Evidence-aware retrieval → MindCore reasoning → Metanoia → Router`

### Operations

- `remember` — durable or session-scoped memory
- `recall` — retrieve connected context
- `improve` — enrich/learn from feedback
- `forget` — remove selected memory

These operations correspond to the current Cognee memory model.

## Security boundary

Agent identity is not security identity. Cognee access must inherit MindCloud's execution-domain rules:

- separate credentials per execution domain
- explicit dataset/tenant boundaries
- audited memory writes
- approval gates for consequential operations
- provenance/evidence attached where available
- no automatic promotion of retrieved knowledge into authoritative state

## Local-first path

Cognee can run locally with its open-source stack and local models, so it is suitable for the open-source-first MindCloud direction.

## Integration state

**Catalog:** adapter-ready  
**Runtime connection:** HTTP adapter deployed; runtime health is exposed through `/api/memory/health` and `/api/runtime/status`  
**Core status:** optional capability, not a MindCore dependency

The production runtime exposes a health boundary for the Cognee service. Railway production currently has a 500 MB `cognee-persistent-data` volume attached at `/data`. The entrypoint directs model/cache files to `/data`; verify the effective Cognee database/data-root paths before treating all memory state as durable long-term storage.
