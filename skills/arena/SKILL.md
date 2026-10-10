---
name: mindcloud-arena
description: Compare competing project solutions with deterministic tests, independent evaluation, evidence checks, and gated skill promotion.
version: 0.1.0
---

# MindCloud Arena Skill

## Purpose
Run repeatable, evidence-backed comparisons of at least two candidate solutions. Arena produces a report; it does not deploy code, mutate production state, or promote a skill automatically.

## Workflow
1. Define one task, measurable acceptance criteria, constraints, and reproducible tests.
2. Prepare at least two candidates with the same task, inputs, constraints, and test harness.
3. Run tests and record stable test IDs, boolean outcomes, and evidence references. Never accept a candidate's self-assigned score as evidence.
4. Run Red Team checks separately, including relevant safety, security, regressions, and edge cases.
5. Evaluate candidates using mindcore/arena-skill.js evaluateArena(). Eligibility requires every test and every supplied required check to pass, plus evidence references for every test.
6. If no candidate qualifies, return no_qualified_winner and revise/rerun. Do not select a winner by score alone.
7. Revalidate the proposed winner against the independent acceptance suite and exact version.
8. Propose promotion only after explicit approval and successful revalidation. A proposal is not a registry write.
9. Registry persistence must separately record immutable version, provenance, evidence, evaluator report, approval identity, and rollback target.

## Evaluation policy
- Passing tests and evidence completeness are hard gates, not tradeable score bonuses.
- Ranking is deterministic: score descending, then candidate ID ascending.
- Reference weighting: test pass rate 80%, required-check pass rate 20%; any failed test/check still disqualifies.
- Missing evidence disqualifies a candidate.
- Never claim production integration, deployment, or registry persistence from a report alone.

## Input contract
evaluateArena({ task, candidates, generatedAt? })
Each candidate has a unique string id, string approach, non-empty tests array of { id, passed, evidenceRef }, and optional requiredChecks array of { id, passed }.

promoteArenaSkill({ report, approved, revalidationPassed, skillId, evidenceRefs })
Promotion requires a verified winner, explicit approval, and successful revalidation. The result deliberately sets registryWritePerformed to false; persistence is a separate operation.

## Runtime workflow
- `POST /api/mindcloud/arena/evaluate` evaluates candidates without writing evidence.
- `POST /api/mindcloud/arena/run` runs the same evaluation and persists a report node, candidate nodes, per-test evidence nodes, and graph edges. It requires the server-configured `MINDCLOUD_EVIDENCE_WRITE_TOKEN` as a bearer token.
- When no candidate qualifies, the workflow calls Metanoia, persists a review node, and links it to the report and candidates for targeted revalidation.
- Read the evidence graph through the separately authenticated `GET /api/mindcloud/evidence-graph` endpoint.
- The workflow is fail-closed for promotion: it never writes a skill to the registry or deploys a candidate. Explicit approval and independent revalidation remain separate gates.

## Initial pilot
Use a low-risk code or documentation task with two or three candidate implementations and one deliberately failing candidate. Save the report and evidence with the project. If no candidate qualifies, use the linked Metanoia review to decide which assumptions or tests to revise. Do not promote until the repository verification suite passes.
