export type BlackbirdResult = {
  query: string;
  kind: "username" | "email";
  platform: string;
  url: string;
  status?: "found" | "not-found" | "unknown";
  observedAt?: string;
  metadata?: Record<string, unknown>;
};

export type OsirisEvidence = {
  source: "blackbird";
  query: string;
  kind: "username" | "email";
  platform: string;
  url: string;
  observedAt: string;
  confidence: "unverified";
  provenance: {
    tool: "blackbird";
    readOnly: true;
  };
  metadata?: Record<string, unknown>;
};

export function normalizeBlackbirdResults(
  input: unknown,
  now = new Date().toISOString(),
): OsirisEvidence[] {
  const rows = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as {results?: unknown[]}).results)
      ? (input as {results: unknown[]}).results
      : [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const query = typeof r.query === "string" ? r.query : "";
    const platform = typeof r.platform === "string" ? r.platform : "";
    const url = typeof r.url === "string" ? r.url : "";
    const kind = r.kind === "email" ? "email" : "username";
    if (!query || !platform || !url) return [];

    return [{
      source: "blackbird",
      query,
      kind,
      platform,
      url,
      observedAt: typeof r.observedAt === "string" ? r.observedAt : now,
      confidence: "unverified",
      provenance: { tool: "blackbird", readOnly: true },
      metadata: r.metadata && typeof r.metadata === "object"
        ? r.metadata as Record<string, unknown>
        : undefined,
    }];
  });
}

export function blackbirdCapability() {
  return {
    id: "blackbird-osint",
    layer: "OSINT",
    status: "adapter-ready" as const,
    mode: "read-only" as const,
    acceptedInputs: ["username", "email"] as const,
    output: "OsirisEvidence[]",
  };
}
