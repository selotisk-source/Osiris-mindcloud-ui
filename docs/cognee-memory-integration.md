# Cognee Memory Integration

Cognee is registered as the **knowledge-memory layer** for MindCloud.

Cognee's current open-source architecture combines graph and vector retrieval and supports persistent agent memory, session-aware memory, feedback/improvement flows and multimodal/data ingestion. citeturn0search9

## MindCloud role

Cognee should sit behind a typed capability boundary rather than becoming the MindCore kernel:

`Sources → Cognee memory/graph → Evidence-aware retrieval → MindCore reasoning → Metanoia → Router`

### Operations

- `remember` — durable or session-scoped memory
- `recall` — retrieve connected context
- `improve` — enrich/learn from feedback
- `forget` — remove selected memory

These operations correspond to the current Cognee memory model. citeturn0search1turn0search9

## Security boundary

Agent identity is not security identity. Cognee access must inherit MindCloud's execution-domain rules:

- separate credentials per execution domain
- explicit dataset/tenant boundaries
- audited memory writes
- approval gates for consequential operations
- provenance/evidence attached where available
- no automatic promotion of retrieved knowledge into authoritative state

## Local-first path

Cognee can run locally with its open-source stack and local models, so it is suitable for the open-source-first MindCloud direction. citeturn0search9

## Integration state

**Catalog:** adapter-ready  
**Runtime connection:** not connected  
**Core status:** optional capability, not a MindCore dependency

The first production integration should benchmark retrieval quality against MindCore's existing evidence graph and determine whether Cognee is best used as the long-term memory substrate, a complementary graph/vector index, or both.
