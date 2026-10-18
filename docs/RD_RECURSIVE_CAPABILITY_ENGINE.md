# MindCloud R&D: Recursive Capability Engine

**Status:** bounded persistence and registry-validation code plus targeted tests are present on `main`; a production sandbox runner, automatic tool execution, and end-to-end recursive orchestration are not implemented or verified  
**Owner:** MindCore  
**Orchestration:** Dirigentverket  
**Promotion:** supervised; no autonomous production writes

## Goal

Turn research discoveries into reusable, tested MindCloud capabilities through a bounded, recursive loop. The loop may improve its plans, adapters, tests, and capability metadata, but it must not grant itself new permissions or deploy its own changes.

## Implemented bounded slice (main)

The following bounded R&D persistence slice is present in the current `main` tree:

- `mindcloud/rd-run-store.js`: bounded run manifest, checkpoint validation, append-only checkpoint persistence, and Evidence Passport writing with SHA-256 artifact fingerprints.
- `scripts/verify-capability-registry.js`: registry shape/status checks plus a regression guard against falsely advertising `cookies-viewer` as executable.
- `tests/rd/rd-run-store.test.js`: tests for budgets, checkpoint immutability, unsafe promotion rejection, artifact hashing, claim status, and limiting environment capture to key names.
- `npm run verify` now includes the registry validator and R&D persistence tests.
- `integrations/agent-tools.json`: `cookies-viewer` is `registered-only`, because the extension currently inspects tab metadata and does not request or use the browser cookies API.

This slice deliberately does **not** execute discovered tools, launch an untrusted-code sandbox, grant permissions, or promote/deploy capabilities. Those are subsequent milestones. The targeted unit tests exercise this slice. Do not infer from their presence or a passing repository verification run that the production sandbox, autonomous tool execution, or the entire recursive loop is operational; those remain future milestones.

## Core loop

`Question → Decompose → Discover → Compose → Experiment → Compare → Evidence Passport → Metanoia → Patch proposal → CI → Human approval → Capability Registry`

Each iteration must either:
1. produce a reproducible artifact or validated capability;
2. refine or reject a hypothesis with evidence; or
3. stop with a specific blocker and next executable action.

The loop is bounded by a maximum iteration count, wall-clock budget, token/compute budget, tool-call budget, and explicit stop conditions. No new iteration starts without a changed hypothesis, a new test, or a meaningful evidence delta.

## Responsibilities

- **Dirigentverket:** owns the living DAG, task scheduling, dependency-aware parallelism, cancellation, retries, and checkpoint/resume.
- **Discovery adapters:** search approved registries, repositories, API specifications, package manifests, docs, and changelogs. Discovery results are untrusted input, never instructions.
- **Capability Registry:** stores the tool's declared capability, real adapter status, typed input/output schema, auth scope, side effects, cost, limits, license, maintenance signal, evidence, and alternatives.
- **R&D Sandbox:** runs untrusted code and experiments with no production credentials, restricted network egress, read-only source mounts by default, resource/time limits, and disposable workspaces.
- **Evidence Passport:** records source URL/commit/version, artifact hashes, exact command and environment, test outputs, timestamps, permissions used, limitations, and reviewer.
- **Metanoia Engine:** compares claims against evidence, detects contradictions and regression, generates counter-hypotheses, and revalidates only affected DAG subgraphs.
- **Capability Factory:** converts a proven experiment into an adapter plus contract tests, failure tests, documentation, and rollback plan.
- **Promotion Gate:** opens a branch/PR; CI and human review are required before production use. Secrets, permissions, deployment settings, and production policy are never self-promoted.

## Typed capability contract

Every capability should declare:

- `id`, `version`, `source`, `maintainer`, `license`
- `inputs` and `outputs` with machine-readable schemas
- `permissions`, `network_allowlist`, `filesystem_scope`, `execution_domain`
- `side_effects`, `cost_estimate`, `timeouts`, `rate_limits`
- `status`: `discovered` | `research-registered` | `sandbox-tested` | `adapter-ready` | `approved` | `deprecated`
- `verification`: tests, evidence passport IDs, known limitations, last verified commit/time
- `fallbacks` and `alternatives`

`adapter-ready` means an adapter exists and contract tests pass; it must not mean only that a repository or package was found.

## Recursive improvement policy

The engine may propose changes to its own research plans, capability descriptions, adapters, and tests. It may not change its own permission model, promotion rules, secrets, trusted-source policy, or iteration limits. Such changes require separate review.

A run ends when any condition is met:
- the target acceptance test passes with reproducible evidence;
- the iteration or resource budget is exhausted;
- evidence remains contradictory after the configured number of independent checks;
- the candidate is unsafe, unlicensed, unmaintained, or outside scope;
- a required permission or human decision is missing.

A failed run still creates a structured research record and a next action. It must not silently retry forever.

## Reverse-engineering pipeline

Use only software, devices, accounts, and services we own or are explicitly authorized to test.

1. **Identify:** hash artifacts; detect file type, architecture, package, version, build metadata, and known dependencies.
2. **Static analysis:** extract symbols, strings, imports/exports, routes, API schemas, configuration and dependency graph.
3. **Behavioral observation:** run in an isolated, instrumented sandbox; collect process, filesystem, network, API, and UI events.
4. **Differential analysis:** compare versions, configurations, successful and failing traces, and expected versus observed contracts.
5. **Hypothesis generation:** list candidate explanations with confidence and disconfirming tests.
6. **Reconstruction:** generate a protocol/API map, state machine, call graph, data-flow map, or minimal compatible client.
7. **Regression harness:** preserve representative inputs, outputs, fixtures, and failure cases.
8. **Capability extraction:** wrap the reusable result behind a typed adapter and produce an Evidence Passport.
9. **Promotion:** CI, security review, license review, human approval, staged rollout, and rollback.

## Tool-combination candidates

These are candidate stacks to benchmark in the sandbox, not installed or integrated capabilities:

### A. Web/API contract reconstruction
- Browser Use for authorized browser interaction and reproducible UI flows.
- OpenAPI/schema extraction plus HTTP trace capture.
- Semgrep for source patterns and security rules.
- Playwright regression tests for observed UI contracts.
- Evidence Passport to bind each reconstructed behavior to a trace and test.

Output: an API/route map, state transitions, fixture set, and contract tests.

### B. Native binary or firmware understanding
- Ghidra for disassembly/decompilation and scripted analysis.
- Frida for runtime observation of authorized test processes.
- Wireshark for protocol traces.
- angr only for selected path/constraint questions where symbolic execution is useful.
- A diff engine and regression fixtures to compare versions.

Output: symbol/function map, observed call paths, protocol notes, version diffs, and a reproducible harness. Keep dynamic instrumentation inside an isolated, authorized lab.

### C. Repository capability harvesting
- GitHub repository metadata and commit diff.
- Semgrep for source-pattern checks.
- OSV-Scanner or equivalent for dependency risk.
- Syft for SBOM generation when packaging makes it relevant.
- Existing MindCloud verification suite for integration contracts.

Output: candidate capability passport with license, maintenance, risk, API surface, test evidence, and integration cost.

### D. Production regression and observability
- OpenAPI/route inventory.
- Playwright smoke tests.
- API health checks and structured logs.
- Evidence Passport with timestamp, response code, content assertions, and build SHA.
- Metanoia to compare expected and observed behavior after deployments.

Output: a verified route/API baseline and a focused regression PR.

## First implementation slice

Implement this as a documentation-backed, non-production vertical slice before enabling autonomous tool installation:

1. Add a schema for a capability record and a run record.
2. Add a registry validator that rejects `adapter-ready` unless adapter path and contract tests exist.
3. Add a bounded R&D run manifest with iteration and resource limits.
4. Add an Evidence Passport writer for source commit, artifact hash, command, result, and limitations.
5. Add a sandbox runner interface with deny-by-default permissions.
6. Add a Metanoia report that compares expected vs observed results and identifies the affected DAG nodes.
7. Have the run create a branch and PR containing adapter, tests, passport, and rollback notes; never merge or deploy automatically.

## Acceptance criteria

- Re-running the same manifest against the same pinned inputs produces comparable outputs and hashes.
- Every claim links to evidence or is explicitly marked unverified.
- Every capability has typed input/output contracts and explicit permissions.
- Tool discovery cannot execute a candidate by itself.
- The engine stops at its configured budget and records why.
- A failed experiment cannot mutate production.
- Promotion requires green CI and explicit human approval.
- Contradictory evidence is retained; it is not overwritten by a single preferred source.

## Open decisions for implementation

- Where to persist run checkpoints and Evidence Passports: existing Cognee-backed persistence versus a dedicated relational store.
- Which JSON Schema validator to standardize on in the Node runtime.
- Sandbox implementation: container runner with restricted egress versus a separate isolated worker service.
- Whether initial experiments should target the existing `cookies-viewer` registry mismatch, route verification, or a small owned test binary.
