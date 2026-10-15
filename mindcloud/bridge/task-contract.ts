export type TaskStatus =
  | "proposed"
  | "planned"
  | "running"
  | "verifying"
  | "accepted"
  | "rejected"
  | "blocked";

export interface VerificationRequirement {
  required: boolean;
  humanGate: boolean;
  readOnly?: boolean;
  checks: string[];
}

export interface MindCloudTask {
  id: string;
  project: string;
  objective: string;
  priority: "low" | "normal" | "high" | "critical";
  dependencies: string[];
  requiredCapabilities: string[];
  inputs: Record<string, unknown>;
  expectedOutputs: string[];
  verification: VerificationRequirement;
  status: TaskStatus;
}

export interface EvidenceRecord {
  source: string;
  observation: string;
  timestamp: string;
  provenance: string;
  confidence: number;
  verificationState: "unverified" | "verified" | "contradicted";
  affectedClaims: string[];
}

export interface ExecutionResult {
  taskId: string;
  status: TaskStatus;
  outputs: Record<string, unknown>;
  evidence: EvidenceRecord[];
  contradictions: string[];
  executionRef?: string;
}

export function createOsirisVerificationTask(): MindCloudTask {
  return {
    id: "osiris-endpoint-verification",
    project: "osiris",
    objective:
      "Verify the OSIRIS CCTV endpoint end-to-end without changing production state.",
    priority: "high",
    dependencies: [],
    requiredCapabilities: ["api", "network", "evidence"],
    inputs: {
      target: "OSIRIS CCTV endpoint",
      mode: "read-only",
    },
    expectedOutputs: [
      "HTTP status",
      "JSON response",
      "camera metadata",
      "stream status",
      "proxy status",
      "actual frame verification",
    ],
    verification: {
      required: true,
      humanGate: true,
      readOnly: true,
      checks: [
        "request",
        "http-status",
        "json",
        "camera-metadata",
        "stream-status",
        "proxy",
        "actual-frame",
      ],
    },
    status: "proposed",
  };
}
