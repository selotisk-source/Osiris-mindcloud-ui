#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRunManifest, validateCheckpoint, writeCheckpoint, writeEvidencePassport } = require("../../mindcloud/rd-run-store");

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mindcloud-rd-"));
  try {
    const manifest = createRunManifest({ runId:"rd-test-01", objective:"Verify bounded R&D persistence", hypothesis:"A checkpoint is reproducible", budget:{maxIterations:2,maxToolCalls:5} });
    assert.equal(manifest.schema, "mindcloud.rd.run.v1");
    assert.equal(manifest.promotion.allowed, false);
    assert.equal(manifest.executionPolicy.productionWrites, false);
    assert.throws(() => createRunManifest({ objective:"bad", budget:{maxIterations:99} }), /invalid_budget/);
    const checkpoint = { runId:manifest.runId, sequence:1, status:"running", manifest, evidenceRefs:[] };
    const saved = await writeCheckpoint(root, checkpoint);
    assert.match(saved.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(JSON.parse(await fs.readFile(saved.path, "utf8")).manifest, manifest);
    assert.throws(() => validateCheckpoint({ ...checkpoint, sequence:0 }), /invalid_checkpoint_sequence/);
    assert.throws(() => validateCheckpoint({ ...checkpoint, manifest:{...manifest,promotion:{allowed:true}} }), /unsafe_checkpoint_policy/);
    const artifactContent = "hello MindCloud";
    const result = await writeEvidencePassport(root, {
      runId:manifest.runId, claims:[{text:"Test ran",status:"supported",sources:["local-test"]},{text:"Production works",status:"unverified"}],
      artifacts:[{name:"hello.txt",content:artifactContent}], command:"node tests/rd/rd-run-store.test.js",
      environment:{NODE_ENV:"test",SECRET:"must-not-be-copied"}, limitations:["Local mock test only"]
    });
    assert.equal(result.passport.claims[1].status,"unverified");
    assert.equal(result.passport.artifacts[0].sha256,crypto.createHash("sha256").update(artifactContent).digest("hex"));
    assert.deepEqual(result.passport.experiment.environment,["NODE_ENV","SECRET"]);
    assert.equal(result.passport.decision.automaticPromotion,false);
    const disk = JSON.parse(await fs.readFile(result.path,"utf8"));
    assert.equal(disk.schema,"mindcloud.evidence-passport.v1");
    console.log(JSON.stringify({status:"PASS",checks:["bounded-run-manifest","atomic-checkpoint-write","unsafe-promotion-rejected","artifact-sha256","claim-statuses","no-secret-values-copied","human-review-required"]},null,2));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
})().catch(error => { console.error(error); process.exitCode=1; });
