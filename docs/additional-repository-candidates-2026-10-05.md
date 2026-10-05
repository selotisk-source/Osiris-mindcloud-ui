# Additional Repository Candidates — 2026-10-05

## 1. Systematic trading research

**Source:** paperswithbacktest/awesome-systematic-trading

This is best treated as a **research registry**, not as a trading engine dependency. The current repository catalogs a large set of libraries, strategies, data sources, risk/analytics tools and research material. It also flags dormant/dead projects and provides a replication-oriented strategy catalogue.

### MindCloud integration

- Feed candidate strategies and libraries into `MarketResearch`.
- Let the research agent select candidates by asset class, methodology, implementation language and maintenance state.
- Create a standard experiment envelope: hypothesis -> data -> implementation -> backtest -> costs/risk -> result -> evidence.
- Keep live execution outside this adapter until a separate broker/execution capability is explicitly approved.
- Attach backtest outputs and assumptions to the EvidenceGraph.

**Assessment:** high-value addition for the research layer; do not equate a published/backtested strategy with a validated live edge.

## 2. PDF redaction forensic auditor

**Source:** phishdestroy/taylor-wessing-data-breach-toolkit

The project is a forensic auditing utility for detecting visual-only PDF redactions where the underlying text layer may remain accessible. The screenshots supplied on 2026-10-05 show a page renderer, raw text extraction and a redaction overlay/audit workflow.

### MindCloud integration

- Add an `EvidenceIntegrity` capability.
- Operate read-only against source documents.
- Render pages and inspect text/content layers.
- Emit structured findings such as:
  - visible redaction present
  - selectable/hidden text detected
  - text-layer residue detected
  - verification inconclusive
- Store the finding, source hash, tool/version and run metadata as an EvidenceArtifact.
- Never overwrite the original document.

This is useful not only for legal PDFs but for validating the integrity of evidence artifacts before they enter the MindCloud evidence graph.

## Candidate priority

| Candidate | Layer | Priority | Why |
|---|---|---:|---|
| Systematic Trading | MarketResearch | 2 | Expands the existing Fincept market layer into strategy/research discovery |
| PDF Redaction Auditor | EvidenceIntegrity | 2 | Strengthens evidence-chain validation and document forensics |

## Boundary

These entries are adapters/research references. They do **not** claim that third-party runtimes are installed, connected or production-verified.
