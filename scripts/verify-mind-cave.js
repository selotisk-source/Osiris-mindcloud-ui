"use strict";
const assert = require("node:assert/strict");
const {enterMindCave} = require("../mindcore/mind-cave");
const {createJoint} = require("../mindcore/the-joint");
const {recursiveTrace} = require("../mindcore/recursive-trace");

const plan = enterMindCave({
  question: "Why do two reports disagree?",
  hypotheses: ["Different observation windows", "One report is outdated"],
  observations: [{id:"obs-1",source:"report-A",observation:"Status open",interpretation:"May be current",limitations:["timestamp unclear"]}],
  unknowns: ["Exact observation times"]
});
assert.equal(plan.type, "mindcore_mind_cave");
assert.equal(plan.status, "exploration_plan");
assert.equal(plan.guardrails.observationIsNotInterpretation, true);
assert.equal(plan.guardrails.missingDataMeansUnknownNotFalse, true);
assert.ok(plan.nextQuestions.some(q => q.includes("begränsningar")));
assert.throws(() => enterMindCave({}), /mind_cave_question_required/);

const jointPlan = enterMindCave({
  question: "Join two views",
  partials: {
    left: {id:"a",claims:[{id:"a1",text:"Bridge open",subject:"bridge",polarity:"positive",evidenceRefs:["report-a"]}]},
    right: {id:"b",claims:[{id:"b1",text:"Bridge closed",subject:"bridge",polarity:"negative",evidenceRefs:["report-b"]}]}
  }
}, {createJoint});
assert.equal(jointPlan.status, "needs_reconciliation");
assert.equal(jointPlan.joint.synthesis.tensions.length, 1);
assert.equal(jointPlan.joint.independentlyValidated, false);

const tracePlan = enterMindCave({
  question:"Trace claim", traceRootId:"claim",
  graph:{nodes:[{id:"source",type:"source",sourceRef:"doc://a"},{id:"claim",type:"claim"}],
    edges:[{id:"e1",from:"source",to:"claim",relation:"supports"}]}
}, {recursiveTrace});
assert.equal(tracePlan.trace.rootId, undefined); // recursiveTrace returns a bounded trace object, not a rootId alias
assert.ok(tracePlan.trace.nodes.some(n => n.id === "claim"));
assert.ok(tracePlan.trace.nodes.some(n => n.id === "source"));
console.log("Mind Cave integration: all assertions passed.");
