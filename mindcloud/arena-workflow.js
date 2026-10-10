"use strict";

const { evaluateArena } = require("../mindcore/arena-skill");
const { evaluateMetanoia } = require("./metanoia-engine");

function runArenaWorkflow(input = {}, evidenceGraph) {
  if (!evidenceGraph || typeof evidenceGraph.addNode !== "function" || typeof evidenceGraph.addEdge !== "function") {
    throw new Error("arena_evidence_graph_required");
  }

  const report = evaluateArena(input);
  const reportNode = evidenceGraph.addNode({
    type: "arena_report",
    label: "Arena evaluation: " + report.task.slice(0, 160),
    sourceRef: "mindcloud:arena",
    content: report
  });
  const candidateNodeIds = [];
  const evidenceNodeIds = [];

  for (const candidate of report.candidates) {
    const candidateNode = evidenceGraph.addNode({
      type: "arena_candidate",
      label: "Candidate " + candidate.id + " — " + candidate.status,
      sourceRef: "mindcloud:arena:candidate:" + candidate.id,
      content: candidate
    });
    candidateNodeIds.push(candidateNode.id);
    evidenceGraph.addEdge({from:candidateNode.id,to:reportNode.id,relation:"evaluated_in"});

    const sourceCandidate = input.candidates.find(item => item.id === candidate.id);
    for (const test of sourceCandidate.tests) {
      const evidenceNode = evidenceGraph.addNode({
        type: "arena_test_result",
        label: "Test " + test.id + " — " + (test.passed ? "passed" : "failed"),
        sourceRef: typeof test.evidenceRef === "string" && test.evidenceRef.trim() ? test.evidenceRef.trim() : null,
        content: {
          candidateId: candidate.id,
          testId: test.id,
          passed: test.passed,
          evidenceRef: typeof test.evidenceRef === "string" && test.evidenceRef.trim() ? test.evidenceRef.trim() : null
        }
      });
      evidenceNodeIds.push(evidenceNode.id);
      evidenceGraph.addEdge({
        from:evidenceNode.id,
        to:candidateNode.id,
        relation:test.passed ? "supports_candidate" : "challenges_candidate"
      });
    }
  }

  let metanoia = null;
  let metanoiaNodeId = null;
  if (report.status === "no_qualified_winner") {
    const claims = report.candidates.map(candidate => ({
      subject: "arena-candidate:" + candidate.id,
      predicate: "eligibility",
      value: candidate.eligible,
      source: "independent-arena-evaluator",
      evidenceRef: input.candidates.find(item => item.id === candidate.id)?.tests.find(test => test.evidenceRef)?.evidenceRef,
      evidenceRequired: true,
      confidence: candidate.eligible ? 1 : 0.4
    }));
    metanoia = evaluateMetanoia({
      claims,
      evidenceRefs: [...new Set(input.candidates.flatMap(candidate => candidate.tests.map(test => test.evidenceRef).filter(Boolean)))],
      affectedNodeIds: candidateNodeIds
    });
    const reviewNode = evidenceGraph.addNode({
      type: "metanoia_review",
      label: "Metanoia review: Arena has no qualified winner",
      sourceRef: "mindcloud:metanoia:arena",
      content: metanoia
    });
    metanoiaNodeId = reviewNode.id;
    evidenceGraph.addEdge({from:reviewNode.id,to:reportNode.id,relation:"reassesses"});
    for (const candidateNodeId of candidateNodeIds) {
      evidenceGraph.addEdge({from:reviewNode.id,to:candidateNodeId,relation:"requests_revalidation"});
    }
  }

  return {
    type: "mindcloud_arena_workflow",
    status: report.status,
    report,
    metanoia,
    evidence: {
      reportNodeId: reportNode.id,
      candidateNodeIds,
      evidenceNodeIds,
      metanoiaNodeId
    },
    promotion: {
      allowed: false,
      registryWritePerformed: false,
      requiresExplicitApproval: true,
      requiresIndependentRevalidation: true
    }
  };
}

module.exports = { runArenaWorkflow };
