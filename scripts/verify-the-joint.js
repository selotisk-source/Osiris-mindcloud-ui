#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { createJoint, normalizeText } = require("../mindcore/the-joint");
const { toolingCatalog } = require("../mindcore/catalog");
const { recipes, suggest } = require("../mindcloud/capability-graph");

const joined = createJoint({
  left:{id:"synthesis-a",summary:"First partial view",claims:[
    {id:"a1",text:"The bridge is open",subject:"bridge status",polarity:"positive",evidenceRefs:["source://a"]},
    {id:"a2",text:"Traffic is delayed",evidenceRefs:["source://traffic"]}
  ]},
  right:{id:"synthesis-b",summary:"Second partial view",claims:[
    {id:"b1",text:"The bridge is open",evidenceRefs:["source://b"]},
    {id:"b2",text:"The bridge is closed",subject:"bridge status",polarity:"negative",evidenceRefs:["source://c"]},
    {id:"b3",text:"Weather is poor",evidenceRefs:["source://weather"]}
  ]}
});
assert.equal(joined.type,"mindcloud_joint_synthesis");
assert.equal(joined.status,"needs_reconciliation");
assert.equal(joined.synthesis.shared.length,1);
assert.equal(joined.synthesis.leftOnly.length,1);
assert.equal(joined.synthesis.rightOnly.length,2);
assert.equal(joined.synthesis.tensions.length,1);
assert.equal(joined.synthesis.tensions[0].resolution,"unresolved");
assert.deepEqual(joined.provenance.evidenceRefs,["source://a","source://b","source://c","source://traffic","source://weather"]);
assert.equal(joined.independentlyValidated,false);
assert.equal(normalizeText("  The—BRIDGE is open! "),"the bridge is open");
const clean = createJoint({
  left:{id:"left",claims:[{id:"l1",text:"Common finding",evidenceRefs:[]}]},
  right:{id:"right",claims:[{id:"r1",text:"Common finding",evidenceRefs:[]}]}
});
assert.equal(clean.status,"joined_pending_validation");
assert.throws(()=>createJoint({left:{id:"same",claims:[]},right:{id:"same",claims:[]}}),/the_joint_partials_must_be_distinct/);
assert.throws(()=>createJoint({left:{id:"left",claims:[{id:"x",text:"x",evidenceRefs:"bad"}]},right:{id:"right",claims:[]}}),/the_joint_evidence_refs_invalid/);
assert.ok(toolingCatalog.some(tool=>tool.id==="mindcore-the-joint" && tool.status==="runtime"));
assert.ok(recipes.some(recipe=>recipe.id==="joint-partial-synthesis"));
assert.ok(suggest({goal:"joint partial synthesis"}).recipes.some(recipe=>recipe.id==="joint-partial-synthesis"));
console.log("MindCore The Joint: all assertions passed.");
