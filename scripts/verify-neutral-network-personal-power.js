"use strict";

const assert = require("node:assert/strict");
const { buildPersonalPowerGraph, SOURCE_ID } = require("../mindcloud/neutral-network-personal-power");

const graph = buildPersonalPowerGraph({ capturedAt: "2026-10-15T20:45:00Z" });

assert.equal(graph.schema, "mindcloud.neutral-network.graph.v1");
assert.equal(graph.graphId, "personal-power");
assert.equal(graph.status, "ingestion_preview");
assert.equal(graph.source.id, SOURCE_ID);
assert.equal(graph.source.kind, "user_supplied_image");
assert.equal(graph.epistemicRules.claimIsNotEvidence, true);
assert.equal(graph.epistemicRules.evidenceIsNotValidation, true);
assert.equal(graph.epistemicRules.inferCausality, false);
assert.equal(graph.epistemicRules.promoteWithoutValidation, false);
assert.ok(graph.nodes.length >= 40, "expected a useful set of transcribed labels");
assert.ok(graph.edges.length > 0, "expected explicit layout relationships");

for (const node of graph.nodes) {
  assert.ok(node.id && node.label && node.type);
  assert.equal(node.verified, false, "transcription must not imply validation");
  assert.equal(node.epistemicStatus, "transcribed_from_image");
  assert.equal(node.provenance.sourceId, SOURCE_ID);
  assert.equal(node.provenance.capturedAt, "2026-10-15T20:45:00Z");
}

for (const edge of graph.edges) {
  assert.ok(graph.nodes.some(node => node.id === edge.from), "edge source must exist");
  assert.ok(graph.nodes.some(node => node.id === edge.to), "edge target must exist");
  assert.equal(edge.relation, "visually_grouped_with");
  assert.equal(edge.verified, false);
}

const labels = graph.nodes.map(node => node.label);
assert.ok(labels.includes("Core Personal Identity"));
assert.ok(labels.includes("The Circle – Trustworthy"));
assert.ok(labels.includes("Love Truth Wisdom"));
assert.ok(labels.includes("Healing & Energy Mastery (XV)"));

const custom = buildPersonalPowerGraph({ sourceId: "test-source" });
assert.equal(custom.source.id, "test-source");
assert.ok(custom.nodes.every(node => node.provenance.sourceId === "test-source"));

console.log("Neutral Network Personal Power ingestion checks passed.");
