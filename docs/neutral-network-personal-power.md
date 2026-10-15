# Neutral Network: Personal Power ingestion

## Purpose

Import the user-supplied **Personal Power** diagram as a provenance-preserving graph in the Neutral Network. The adapter is a structured transcription layer, not a psychological assessment engine.

## Data flow

`image → transcription observations → typed graph nodes/edges → evidence review → Metanoia revalidation → MindCore-approved promotion`

The adapter currently implements the transcription-observation and graph-shaping stages. It does not write into a production evidence store, call a model, diagnose, recommend treatment, or promote the graph automatically.

## Contract

- Schema: `mindcloud.neutral-network.graph.v1`
- Graph ID: `personal-power`
- Node types: `concept_group`, `diagram_label`
- Edge relation: `visually_grouped_with`
- Each node and edge carries source provenance.
- Labels carry transcription confidence; ambiguous words remain low/medium confidence.
- Every node is `verified: false`; the graph status is `ingestion_preview`.
- The epistemic rules explicitly preserve `CLAIM ≠ EVIDENCE ≠ VALIDATION`, prohibit inferred causality, and prevent automatic promotion.

## Safe integration boundary

The graph is suitable for indexing, search and later human review. Any future connection to a persistent Evidence Graph must preserve the original image/source ID, transcription confidence, timestamps and revisions. A reviewer may correct the transcript without erasing the prior version. Any interpretation or recommendation must be a separate, attributed hypothesis node and pass the existing Metanoia/validation and approval gates before promotion.

## Verification

Run:

```sh
node scripts/verify-neutral-network-personal-power.js
```

The regression test checks schema, provenance, required labels, edge integrity, uncertainty preservation and non-promotion defaults. The full suite includes this check through `npm run verify`.
