/**
 * MindCore mission/mandate contract.
 *
 * This is intentionally a pure validation boundary: it does not execute tools,
 * grant authority, or replace Dirigentverket. It makes mission scope explicit
 * and machine-checkable before a mission enters execution.
 */

const REQUIRED = [
  "mission_id",
  "regent_id",
  "authority_scope",
  "constraints",
  "formation_id",
  "execution_plan_id",
  "evidence_required",
  "approval_gate",
  "status",
  "version",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateMissionContract(mission) {
  const errors = [];

  if (!isPlainObject(mission)) {
    return { valid: false, errors: ["mission must be an object"] };
  }

  for (const field of REQUIRED) {
    if (!(field in mission)) errors.push(`missing required field: ${field}`);
  }

  for (const field of [
    "mission_id",
    "regent_id",
    "formation_id",
    "execution_plan_id",
    "status",
  ]) {
    if (field in mission && !isNonEmptyString(mission[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if ("authority_scope" in mission && !Array.isArray(mission.authority_scope)) {
    errors.push("authority_scope must be an array");
  }

  if ("evidence_required" in mission && !Array.isArray(mission.evidence_required)) {
    errors.push("evidence_required must be an array");
  }

  if ("constraints" in mission && !isPlainObject(mission.constraints)) {
    errors.push("constraints must be an object");
  }

  if ("approval_gate" in mission && !isPlainObject(mission.approval_gate)) {
    errors.push("approval_gate must be an object");
  }

  if ("version" in mission &&
      (!Number.isSafeInteger(mission.version) || mission.version < 1)) {
    errors.push("version must be a positive safe integer");
  }

  const allowedStatuses = new Set([
    "proposed",
    "approved",
    "executing",
    "needs_review",
    "completed",
    "failed",
    "cancelled",
  ]);
  if ("status" in mission && !allowedStatuses.has(mission.status)) {
    errors.push(`unsupported status: ${mission.status}`);
  }

  // A mission cannot claim completion while required evidence is unresolved.
  if (
    mission.status === "completed" &&
    Array.isArray(mission.evidence_required) &&
    mission.evidence_required.length > 0 &&
    mission.evidence_verified !== true
  ) {
    errors.push("completed mission requires evidence_verified=true");
  }

  return { valid: errors.length === 0, errors };
}

export function isMissionExecutable(mission) {
  const result = validateMissionContract(mission);
  if (!result.valid) return false;

  return (
    mission.status === "approved" ||
    mission.status === "executing"
  );
}
