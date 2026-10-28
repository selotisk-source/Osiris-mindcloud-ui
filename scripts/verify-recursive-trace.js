#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { recursiveTrace } = require("../mindcore/recursive-trace");
const { toolingCatalog } = require("../mindcore/catalog");
const { recipes, suggest } = require("../mindcloud/capability-graph");

const graph = {
  nodes:[
    {id:"claim",type:"claim",label:"Final claim",sourceRef:null,content:{status:"proposed",evidenceRefs:["test://evidence/1"]},contentHash:"h1"},
    {id:"decision",type:"decision",label:"Decision",sourceRef:"test://decision/1",content:{status:"reviewed"},contentHash:"h2"},
    {id:"source",type:"source",label:"Source",sourceRef:"https://example.test/source",content:{},contentHash:"h3"},
    {id:"downstream",type:"task",label:"Dependent task",content:{},contentHash:"h4"}
  ],
  edges:[
    {id:"e1",from:"source",to:"decision",relation:"supports"},
    {id:"e2",from:"decision",to:"claim",relation:"informs"},
    {id:"e3",from:"claim",to:"downstream",relation:"affects"},
    {id:"e4",from:"decision",to:"source",relation:"references"}
  ]
};
const both = recursiveTrace(graph,{rootId:"claim"});
assert.equal(both.type,"mindcore_recursive_trace");
assert.equal(both.status,"complete");
assert.deepEqual(new Set(both.nodes.map(n=>n.id)),new Set(["claim","decision","source","downstream"]));
assert.ok(both.cycleCount >= 1);
assert.deepEqual(both.evidence.references,["https://example.test/source","test://decision/1","test://evidence/1"]);
assert.equal(both.evidence.independentlyValidated,false);
const backward = recursiveTrace(graph,{rootId:"claim",direction:"backward"});
assert.deepEqual(new Set(backward.nodes.map(n=>n.id)),new Set(["claim","decision","source"]));
const forward = recursiveTrace(graph,{rootId:"claim",direction:"forward"});
assert.deepEqual(new Set(forward.nodes.map(n=>n.id)),new Set(["claim","downstream"]));
const bounded = recursiveTrace(graph,{rootId:"claim",maxNodes:2});
assert.equal(bounded.status,"partial");
assert.equal(bounded.truncation.nodes,true);
const depthBounded = recursiveTrace(graph,{rootId:"claim",direction:"backward",maxDepth:0});
assert.equal(depthBounded.status,"partial");
assert.throws(()=>recursiveTrace(graph,{rootId:"missing"}),/recursive_trace_root_not_found/);
assert.throws(()=>recursiveTrace(graph,{rootId:"claim",direction:"sideways"}),/recursive_trace_direction_invalid/);
assert.throws(()=>recursiveTrace({nodes:[],edges:[{from:"x",to:"y",relation:"bad"}]},{rootId:"x"}),/recursive_trace_edge_invalid/);
assert.ok(toolingCatalog.some(tool => tool.id === "mindcore-recursive-trace" && tool.status === "runtime"));
assert.ok(recipes.some(recipe => recipe.id === "recursive-trace-evidence"));
assert.ok(suggest({goal:"recursive trace evidence"}).recipes.some(recipe => recipe.id === "recursive-trace-evidence"));
console.log("MindCore Recursive Trace: all assertions passed.");
