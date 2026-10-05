import type { EvidenceArtifact } from "./contracts";

export type RedactionFindingKind =
  | "visible-redaction"
  | "text-layer-present"
  | "text-layer-overlap"
  | "metadata-risk"
  | "render-text-mismatch";

export interface DocumentAuditRequest {
  documentId: string;
  filename: string;
  sha256?: string;
  offlineOnly?: boolean;
}

export interface RedactionFinding {
  kind: RedactionFindingKind;
  severity: "info" | "warning" | "critical";
  page?: number;
  message: string;
  evidence?: EvidenceArtifact;
}

/**
 * Defensive document-forensics boundary inspired by PDF redaction auditors.
 * It describes findings and provenance; it does not publish or exfiltrate
 * recovered sensitive text.
 */
export interface DocumentForensicsAdapter {
  audit(request: DocumentAuditRequest): Promise<RedactionFinding[]>;
}
