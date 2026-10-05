import type { EvidenceArtifact } from "./contracts";

export type TradingResearchKind =
  | "strategy"
  | "library"
  | "data-source"
  | "backtester"
  | "risk"
  | "pricing"
  | "machine-learning";

export interface TradingResearchQuery {
  query: string;
  kinds?: TradingResearchKind[];
  maxResults?: number;
}

export interface TradingResearchCandidate {
  id: string;
  source: string;
  kind: TradingResearchKind;
  rationale: string;
  provenance: EvidenceArtifact;
}

/**
 * Read-only boundary for the Awesome Systematic Trading catalogue.
 * The catalogue is a research index, not an execution engine.
 */
export interface SystematicTradingIndex {
  search(request: TradingResearchQuery): Promise<TradingResearchCandidate[]>;
}

export class CuratedTradingIndex implements SystematicTradingIndex {
  constructor(private readonly entries: TradingResearchCandidate[] = []) {}

  async search(request: TradingResearchQuery): Promise<TradingResearchCandidate[]> {
    const q = request.query.trim().toLowerCase();
    const kinds = new Set(request.kinds ?? []);
    const limit = request.maxResults ?? 10;

    return this.entries
      .filter((entry) => !kinds.size || kinds.has(entry.kind))
      .filter((entry) => !q || `${entry.id} ${entry.source} ${entry.rationale}`.toLowerCase().includes(q))
      .slice(0, limit);
  }
}
