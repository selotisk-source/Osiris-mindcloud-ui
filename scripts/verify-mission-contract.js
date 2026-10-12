const assert = require("node:assert/strict");
const {
  isMissionEligibleForHandoff,
  validateMissionContract,
} = require("../mindcore/mission-contract");

const baseMission = {
  mission_id: "mission-test-1",
  regent_id: "regent-test",
  authority_scope: ["research"],
  constraints: { risk: "low", resources: ["web"] },
  formation_id: "formation-test",
  execution_plan_id: "plan-test",
  evidence_required: ["source"],
  approval_gate: { required: true },
  status: "approved",
  version: 1,
};

assert.equal(validateMissionContract(baseMission).valid, true);
assert.equal(isMissionEligibleForHandoff(baseMission), true);

const missingScope = { ...baseMission };
delete missingScope.authority_scope;
assert.equal(validateMissionContract(missingScope).valid, false);

const malformedScope = { ...baseMission, authority_scope: ["research", " "] };
assert.equal(validateMissionContract(malformedScope).valid, false);

const badVersion = { ...baseMission, version: 0 };
assert.equal(validateMissionContract(badVersion).valid, false);

const malformedApprovalGate = { ...baseMission, approval_gate: { required: "yes" } };
assert.equal(validateMissionContract(malformedApprovalGate).valid, false);

const unsupportedStatus = { ...baseMission, status: "magic" };
assert.equal(validateMissionContract(unsupportedStatus).valid, false);

const unverifiedCompletion = {
  ...baseMission,
  status: "completed",
  evidence_verified: false,
};
const completionResult = validateMissionContract(unverifiedCompletion);
assert.equal(completionResult.valid, false);
assert.ok(completionResult.errors.some((error) =>
  error.includes("evidence_verified=true"),
));

const proposed = { ...baseMission, status: "proposed" };
assert.equal(isMissionEligibleForHandoff(proposed), false);

// A client-supplied approval flag must not be required or treated as authority.
assert.equal(validateMissionContract({
  ...baseMission,
  approval_gate: { required: true, approved: true },
}).valid, true);

console.log("mission-contract verification: PASS");
