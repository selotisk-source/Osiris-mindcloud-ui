"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const STATUSES = new Set([
  "discovered", "research-registered", "registered-only", "sandbox-tested",
  "adapter-ready", "approved", "deprecated", "parked-cost-review",
  "parked-integration-review"
]);
const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const DEFAULT_BUDGET = Object.freeze({ maxIterations: 3, maxWallClockMs: 300000, maxToolCalls: 30, maxArtifactBytes: 5_000_000 });

function validateCapabilityRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== "object" || !Array.isArray(registry.tools)) {
    return { ok: false, errors: ["registry.tools must be an array"], count: 0 };
  }
  const seen = new Set();
  for (const tool of registry.tools) {
    if (!tool || typeof tool !== "object") { errors.push("tool entry must be an object"); continue; }
    if (typeof tool.id !== "string" || !ID_RE.test(tool.id)) errors.push("invalid capability id");
    else if (seen.has(tool.id)) errors.push("duplicate capability id: " + tool.id);
    else seen.add(tool.id);
    if (!STATUSES.has(tool.status)) errors.push((tool.id || "unknown") + ": unsupported status");
    if (typeof tool.source !== "string" || !tool.source.trim()) errors.push((tool.id || "unknown") + ": source required");
    if (typeof tool.layer !== "string" || !tool.layer.trim()) errors.push((tool.id || "unknown") + ": layer required");
    if (!Array.isArray(tool.operations) || tool.operations.length === 0 || tool.operations.some(op => typeof op !== "string" || !op.trim())) {
      errors.push((tool.id || "unknown") + ": non-empty string operations required");
    }
    if (tool.status === "adapter-ready" && (!tool.adapter_path || !tool.contract_test_path) && tool.id === "cookies-viewer") {
      errors.push("cookies-viewer: adapter-ready requires adapter and contract-test paths");
    }
  }
  // Known negative capability assertion: do not let the registry imply cookie access that is absent from the extension.
  const cookie = registry.tools.find(tool => tool && tool.id === "cookies-viewer");
  if (cookie && cookie.status === "adapter-ready") errors.push("cookies-viewer: cannot be adapter-ready without implemented cookie API and contract tests");
  return { ok: errors.length === 0, errors, count: registry.tools.length };
}

function createRunManifest(input = {}) {
  const runId = input.runId || crypto.randomUUID();
  if (!ID_RE.test(runId)) throw new Error("invalid_run_id");
  const budget = { ...DEFAULT_BUDGET, ...(input.budget || {}) };
  for (const [key, max] of Object.entries({ maxIterations: 8, maxWallClockMs: 3_600_000, maxToolCalls: 250, maxArtifactBytes: 25_000_000 })) {
    const value = budget[key];
    if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new Error("invalid_budget_" + key);
  }
  const objective = String(input.objective || "").trim();
  if (!objective || objective.length > 2000) throw new Error("invalid_objective");
  return {
    schema: "mindcloud.rd.run.v1", runId, objective,
    hypothesis: String(input.hypothesis || "").slice(0, 2000),
    status: "created", createdAt: new Date().toISOString(),
    budget, counters: { iterations: 0, toolCalls: 0, artifactBytes: 0 },
    checkpointSeq: 0, promotion: { allowed: false, requiresHumanApproval: true },
    executionPolicy: { candidateExecution: "sandbox-only", productionWrites: false, secretInheritance: false }
  };
}

function validateCheckpoint(checkpoint) {
  if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)) throw new Error("checkpoint_object_required");
  if (!ID_RE.test(String(checkpoint.runId || ""))) throw new Error("invalid_run_id");
  if (!Number.isSafeInteger(checkpoint.sequence) || checkpoint.sequence < 1) throw new Error("invalid_checkpoint_sequence");
  if (!["created", "running", "paused", "blocked", "completed", "rejected"].includes(checkpoint.status)) throw new Error("invalid_checkpoint_status");
  if (!checkpoint.manifest || checkpoint.manifest.runId !== checkpoint.runId) throw new Error("checkpoint_manifest_mismatch");
  if (checkpoint.manifest.promotion?.allowed !== false || checkpoint.manifest.executionPolicy?.productionWrites !== false) {
    throw new Error("unsafe_checkpoint_policy");
  }
}

async function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const temp = filePath + "." + crypto.randomUUID() + ".tmp";
  try {
    await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    await fs.rename(temp, filePath);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

async function writeCheckpoint(rootDir, checkpoint) {
  validateCheckpoint(checkpoint);
  const base = path.resolve(rootDir);
  const destination = path.resolve(base, checkpoint.runId, "checkpoint-" + String(checkpoint.sequence).padStart(6, "0") + ".json");
  if (!destination.startsWith(base + path.sep)) throw new Error("checkpoint_path_escape");
  const dir = path.dirname(destination);
  await fs.mkdir(dir, { recursive: true });
  const temp = destination + "." + crypto.randomUUID() + ".tmp";
  try {
    await fs.writeFile(temp, JSON.stringify(checkpoint, null, 2) + "\\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    // Hard-link publication is atomic and fails rather than replacing an existing checkpoint.
    await fs.link(temp, destination);
  } catch (error) {
    if (error && error.code === "EEXIST") throw new Error("checkpoint_already_exists");
    throw error;
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
  return { path: destination, sha256: crypto.createHash("sha256").update(JSON.stringify(checkpoint)).digest("hex") };
}

async function writeEvidencePassport(rootDir, input = {}) {
  const runId = String(input.runId || "");
  if (!ID_RE.test(runId)) throw new Error("invalid_run_id");
  if (!Array.isArray(input.claims) || input.claims.length === 0) throw new Error("passport_claims_required");
  const claims = input.claims.map((claim, index) => {
    if (!claim || typeof claim.text !== "string" || !claim.text.trim()) throw new Error("invalid_claim_" + index);
    const status = claim.status || "unverified";
    if (!["supported", "contradicted", "unverified"].includes(status)) throw new Error("invalid_claim_status_" + index);
    return { text: claim.text.trim().slice(0, 2000), status, sources: Array.isArray(claim.sources) ? claim.sources.map(String).slice(0, 20) : [] };
  });
  const artifacts = (Array.isArray(input.artifacts) ? input.artifacts : []).map((artifact, index) => {
    if (!artifact || typeof artifact.name !== "string" || typeof artifact.content !== "string") throw new Error("invalid_artifact_" + index);
    const bytes = Buffer.byteLength(artifact.content, "utf8");
    if (bytes > DEFAULT_BUDGET.maxArtifactBytes) throw new Error("artifact_too_large_" + index);
    return { name: artifact.name.slice(0, 200), sha256: crypto.createHash("sha256").update(artifact.content, "utf8").digest("hex"), bytes };
  });
  const passport = {
    schema: "mindcloud.evidence-passport.v1", passportId: crypto.randomUUID(), runId,
    createdAt: new Date().toISOString(), claims, artifacts,
    experiment: { command: input.command ? String(input.command).slice(0, 1000) : null, environment: input.environment && typeof input.environment === "object" ? Object.keys(input.environment).slice(0, 50) : [], limitations: Array.isArray(input.limitations) ? input.limitations.map(String).slice(0, 30) : [] },
    decision: { promotion: "blocked-pending-human-review", automaticPromotion: false }
  };
  const base = path.resolve(rootDir);
  const destination = path.resolve(base, runId, "evidence-passport-" + passport.passportId + ".json");
  if (!destination.startsWith(base + path.sep)) throw new Error("passport_path_escape");
  await writeJsonAtomic(destination, passport);
  return { path: destination, passport };
}

module.exports = { DEFAULT_BUDGET, validateCapabilityRegistry, createRunManifest, validateCheckpoint, writeCheckpoint, writeEvidencePassport };
