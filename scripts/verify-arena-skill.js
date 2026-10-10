#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { evaluateArena, promoteArenaSkill } = require("../mindcore/arena-skill");
const { toolingCatalog } = require("../mindcore/catalog");
const { recipes, suggest } = require("../mindcloud/capability-graph");
const candidates = [
 {id:"candidate-b",approach:"Complete implementation",tests:[{id:"input-valid",passed:true,evidenceRef:"test://arena/input-valid"},{id:"output-valid",passed:true,evidenceRef:"test://arena/output-valid"}],requiredChecks:[{id:"red-team",passed:true},{id:"regression",passed:true}]},
 {id:"candidate-a",approach:"Faster but incomplete implementation",tests:[{id:"input-valid",passed:true,evidenceRef:"test://arena/input-valid-a"},{id:"output-valid",passed:false,evidenceRef:"test://arena/output-invalid-a"}],requiredChecks:[{id:"red-team",passed:true}]}
];
const report = evaluateArena({task:"Validate a small deterministic transformation",candidates});
assert.equal(report.type,"mindcloud_arena_report");
assert.equal(report.status,"verified_winner");
assert.equal(report.winnerId,"candidate-b");
assert.equal(report.candidates.find(c=>c.id==="candidate-a").eligible,false);
assert.equal(report.promotion.allowed,false);
assert.throws(()=>promoteArenaSkill({report,approved:true,revalidationPassed:true,skillId:"transform-skill"}),/arena_explicit_approval_required/);
assert.throws(()=>promoteArenaSkill({report,approved:true,revalidationPassed:false,skillId:"transform-skill"}),/arena_revalidation_required/);
const proposal = promoteArenaSkill({report,approved:true,revalidationPassed:true,skillId:"transform-skill",evidenceRefs:["test://arena/input-valid","test://arena/output-valid"]});
assert.equal(proposal.status,"approved_for_registry");
assert.equal(proposal.registryWritePerformed,false);
const noWinner = evaluateArena({task:"A deliberately failing pilot",candidates:candidates.map(c=>({...c,tests:c.tests.map(t=>({...t,passed:false}))}))});
assert.equal(noWinner.status,"no_qualified_winner");
assert.equal(noWinner.winnerId,null);
assert.throws(()=>promoteArenaSkill({report:noWinner,approved:true,revalidationPassed:true,skillId:"no-winner"}),/arena_no_verified_winner/);
assert.throws(()=>evaluateArena({task:"bad",candidates:[candidates[0]]}),/arena_requires_competing_candidates/);
assert.throws(()=>evaluateArena({task:"bad",candidates:[{...candidates[0],id:"duplicate"},{...candidates[1],id:"duplicate"}]}),/arena_candidate_ids_must_be_unique/);
const missingEvidence = evaluateArena({task:"Missing evidence must fail closed",candidates:candidates.map((c,i)=>({...c,id:"evidence-"+i,tests:c.tests.map(t=>({...t,evidenceRef:""}))}))});
assert.equal(missingEvidence.status,"no_qualified_winner");
assert.ok(toolingCatalog.some(tool=>tool.id==="mindcloud-arena-skill" && tool.status==="runtime"));
assert.ok(recipes.some(recipe=>recipe.id==="arena-compare-verify-promote"));
assert.ok(suggest({goal:"Evaluation and verification"}).recipes.some(recipe=>recipe.id==="arena-compare-verify-promote"));
console.log("MindCloud Arena Skill: all 18 assertions passed.");
