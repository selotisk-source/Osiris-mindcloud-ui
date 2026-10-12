import assert from "node:assert/strict";
import {
  isMissionExecutable,
  validateMissionContract,
} from "../mindcore/mission-contract.js";

const baseMission = {
  mission_id: "mission-test-1",
  regent_id: "regent-test",
  authority_scope: ["research"],
  constraints: { risk: "low", resources: ["web"] },
  formation_id: "formation-test",
  execution_plan_id: "plan-test",
  evidence_required: ["source"],
  approval_gate: { required: true, approved: true },
  status: "approved",
  version: 1,
};

assert.equal(validateMissionContract(baseMission).valid, true);
assert.equal(isMissionExecutable(baseMission), true);

const missingScope = { ...baseMission };
delete missingScope.authority_scope;
assert.equal(validateMissionContract(missingScope).valid, false);

const badVersion = { ...baseMission, version: 0 };
assert.equal(validateMissionContract(badVersion).valid, false);

const unsupportedStatus = { ...baseMission, status: "magic" };
assert.equal(validateMissionContract(unsupportedStatus).valid, false);

const unverifiedCompletion = {
  ...baseMission,
  status: "completed",
  evidence_verified: false,
};
const completionResult = validateMissionContract(unverifiedCompletion);
assert.equal(completionResult.valid, false);
assert.ok(
  completionResult.errors.some((error) =>
    error.includes("evidence_verified=true"),
  ),
);

const proposed = { ...baseMission, status: "proposed" };
assert.equal(isMissionExecutable(proposed), false);

console.log("mission-contract verification: PASS");
