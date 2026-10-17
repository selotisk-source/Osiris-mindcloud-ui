# CopyQ → MindCloud local ingestion node

## Purpose

CopyQ is a local clipboard-history source. This integration contract converts an item the user explicitly selects or exports into a provenance-preserving MindCloud artifact. It does not scrape clipboard history in the background, upload automatically, or execute clipboard content.

## Current implementation

- Normalizer: `mindcloud/copyq-ingestion.js`
- Contract/regression test: `scripts/verify-copyq-ingestion.js`
- Schema: `mindcloud.artifact.v1`
- Identity: SHA-256 over MIME type + NUL separator + UTF-8 content, enabling deduplication.
- Provenance: source app, optional CopyQ item ID, capture timestamp, MIME type and content hash.
- Review gate: every item starts as `unreviewed` and `requiresHumanReview: true`.
- Limits: 1 MB per item; only text, image, JSON, XML and PDF MIME types are accepted.

## Classification

The initial deterministic classifier labels items as `image`, `document`, `link`, `code-or-command`, or `text`. This is triage metadata, not a claim that the content is true. Evidence validation, relation extraction and graph promotion remain MindCore responsibilities.

## Data flow

```text
CopyQ item selected by user
  → local export / explicit handoff
  → normalizeCopyQItem
  → SHA-256 identity + provenance
  → unreviewed artifact
  → existing MindCore extraction / validation pipeline
  → evidence graph only after the normal policy and review gates
```

## Security and integration boundary

Do not send clipboard content directly to a public endpoint or log it. Clipboard history can contain passwords, session tokens, private messages and other secrets. The normalizer is side-effect-free; it neither reads CopyQ's database nor sends network requests. A supervised upload bridge must be added only against the existing authenticated MindCore ingestion API, with server-side authorization, payload limits, audit IDs and persistence/readback tests. No endpoint is hard-coded here because the existing authenticated ingestion route has not yet been verified as a supported public contract.

## Local verification

Run:

```sh
node scripts/verify-copyq-ingestion.js
```

The full project verification sequence also includes this regression test.
