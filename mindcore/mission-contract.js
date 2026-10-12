/**
 * MindCore mission/mandate contract.
 *
 * Pure structural validation only. This module does not authenticate an
 * approval, verify evidence, grant authority, execute tools, or replace
 * Dirigentverket. Runtime execution must independently resolve mandate and
 * approval state from trusted server-side sources.
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

const ALLOWED_STATUSES = new Set([
  "proposed",
  "approved",
  "executing",
  "needs_review",
  "completed",
  "failed",
  "cancelled",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateMissionContract(mission) {
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

  if ("authority_scope" in mission && !isStringArray(mission.authority_scope)) {
    errors.push("authority_scope must be an array of non-empty strings");
  }

  if ("evidence_required" in mission && !isStringArray(mission.evidence_required)) {
    errors.push("evidence_required must be an array of non-empty strings");
  }

  if ("constraints" in mission && !isPlainObject(mission.constraints)) {
    errors.push("constraints must be an object");
  }

  if ("approval_gate" in mission) {
    if (!isPlainObject(mission.approval_gate)) {
      errors.push("approval_gate must be an object");
    } else if (typeof mission.approval_gate.required !== "boolean") {
      errors.push("approval_gate.required must be a boolean");
    }
  }

  if ("version" in mission &&
      (!Number.isSafeInteger(mission.version) || mission.version < 1)) {
    errors.push("version must be a positive safe integer");
  }

  if ("status" in mission && !ALLOWED_STATUSES.has(mission.status)) {
    errors.push(`unsupported status: ${mission.status}`);
  }

  // This catches inconsistent state; it does not verify evidence provenance.
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

/**
 * Indicates only that the contract has an allowed handoff status.
 * Never use this as proof of authority or as a substitute for server-side
 * policy and approval checks.
 */
function isMissionEligibleForHandoff(mission) {
  const result = validateMissionContract(mission);
  return result.valid && (
    mission.status === "approved" ||
    mission.status === "executing"
  );
}

module.exports = { validateMissionContract, isMissionEligibleForHandoff };
