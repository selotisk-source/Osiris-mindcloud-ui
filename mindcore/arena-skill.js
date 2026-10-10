"use strict";
const REQUIRED_FIELDS = ["id", "approach", "tests"];
function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return "candidate_invalid";
  for (const field of REQUIRED_FIELDS) {
    if (field === "tests") {
      if (!Array.isArray(candidate.tests) || candidate.tests.length === 0) return "candidate_tests_required";
    } else if (typeof candidate[field] !== "string" || !candidate[field].trim()) return "candidate_" + field + "_required";
  }
  if (candidate.tests.some(test => !test || typeof test.id !== "string" || typeof test.passed !== "boolean")) return "candidate_test_result_invalid";
  return null;
}
function evaluateArena(input = {}) {
  if (!input.task || typeof input.task !== "string" || !input.task.trim()) throw new Error("arena_task_required");
  if (!Array.isArray(input.candidates) || input.candidates.length < 2) throw new Error("arena_requires_competing_candidates");
  const ids = new Set();
  const evaluated = input.candidates.map(candidate => {
    const invalid = validateCandidate(candidate);
    if (invalid) throw new Error(invalid);
    if (ids.has(candidate.id)) throw new Error("arena_candidate_ids_must_be_unique");
    ids.add(candidate.id);
    const total = candidate.tests.length;
    const passed = candidate.tests.filter(test => test.passed).length;
    const checks = Array.isArray(candidate.requiredChecks) ? candidate.requiredChecks : [];
    const failedChecks = checks.filter(check => !check || check.passed !== true);
    const testRate = passed / total;
    const checkRate = checks.length ? (checks.length - failedChecks.length) / checks.length : 1;
    const score = Math.round((testRate * 80 + checkRate * 20) * 100) / 100;
    const evidenceComplete = candidate.tests.every(test => test.evidenceRef && String(test.evidenceRef).trim());
    const eligible = passed === total && failedChecks.length === 0 && evidenceComplete;
    return { id:candidate.id, approach:candidate.approach, score, tests:{total,passed,failed:total-passed}, failedChecks:failedChecks.map(check=>check && check.id || "unnamed_check"), evidenceComplete, eligible, status:eligible?"verified_candidate":"rejected_candidate" };
  }).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
  const winner = evaluated.find(candidate => candidate.eligible) || null;
  return { type:"mindcloud_arena_report", schemaVersion:1, task:input.task.trim(), status:winner?"verified_winner":"no_qualified_winner", candidateCount:evaluated.length, candidates:evaluated, winnerId:winner?winner.id:null, promotion:{allowed:false,requiresExplicitApproval:true,reason:winner?"winner_requires_separate_promotion_approval":"no_candidate_passed_all_gates"}, generatedAt:input.generatedAt||null };
}
function promoteArenaSkill(input = {}) {
  if (!input.report || input.report.type !== "mindcloud_arena_report") throw new Error("arena_report_required");
  if (input.report.status !== "verified_winner" || !input.report.winnerId) throw new Error("arena_no_verified_winner");
  if (input.approved !== true) throw new Error("arena_explicit_approval_required");
  if (input.revalidationPassed !== true) throw new Error("arena_revalidation_required");
  if (typeof input.skillId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.skillId)) throw new Error("arena_skill_id_invalid");
  return {type:"mindcloud_versioned_skill_proposal",skillId:input.skillId,sourceArenaTask:input.report.task,winnerId:input.report.winnerId,evidenceRefs:Array.isArray(input.evidenceRefs)?[...new Set(input.evidenceRefs.filter(Boolean))]:[],status:"approved_for_registry",registryWritePerformed:false,requiresRegistryCommit:true};
}
module.exports = { evaluateArena, promoteArenaSkill };
