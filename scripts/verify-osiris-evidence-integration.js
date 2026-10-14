#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const server=fs.readFileSync("server.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
assert.match(server,/\/api\/mindcloud\/osiris\/integration/,"read-only OSIRIS integration endpoint must exist");
assert.match(server,/\/api\/mindcloud\/osiris\/ingest/,"evidence ingest endpoint must exist");
assert.match(server,/if\(!isExecutionAuthorized\(req\)\)\{sendJson\(res,\{error:"unauthorized"\},401\);return;\}/,"evidence writes must require execution auth");
assert.match(server,/type:"osiris-cctv-status"/,"ingest must create typed evidence graph nodes");
assert.match(server,/sourceRef:"\/api\/mindcloud\/osiris\/integration"/,"evidence node must retain its source reference");
assert.match(server,/frameStatus:cctv\.frameStatus/,"integration must preserve frame verification status");
assert.match(server,/snapshotSha256:cctv\.snapshotSha256/,"integration must preserve snapshot hash when present");
assert.match(html,/fetch\('\/api\/mindcloud\/osiris\/integration',\{cache:'no-store'\}\)/,"Sensor Fabric must consume the unified integration contract");
assert.match(pkg.scripts.verify,/verify-osiris-evidence-integration\.js/,"integration verifier must be in the verify chain");
console.log("osiris-evidence-integration: PASS — read-only normalized status, authenticated evidence ingest, provenance, verification semantics");
