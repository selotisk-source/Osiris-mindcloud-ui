const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

class VersionHistory {
  constructor(initialModel = { name: "mindcore-model", state: {} }, options = {}) {
    this.storePath = options.storePath || process.env.MINDCLOUD_MODEL_VERSION_STORE || "";
    this.sequence = 1;
    this.versions = [];
    if (this.storePath && fs.existsSync(this.storePath)) {
      this.load();
    } else {
      this.versions = [{
        id: "model-v1",
        sequence: 1,
        parentId: null,
        createdAt: new Date().toISOString(),
        rationale: "Initial model snapshot",
        changeType: "initial",
        model: structuredClone(initialModel),
        modelHash: this.hash(initialModel),
        evidenceRefs: []
      }];
      this.persist();
    }
  }

  hash(value) {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  load() {
    let stored;
    try {
      stored = JSON.parse(fs.readFileSync(this.storePath, "utf8"));
    } catch {
      throw new Error("model_version_store_invalid_json");
    }
    if (!stored || stored.schemaVersion !== 1 || !Array.isArray(stored.versions) || stored.versions.length < 1) {
      throw new Error("model_version_store_invalid_schema");
    }
    for (const version of stored.versions) {
      if (!version || typeof version.id !== "string" || !Number.isInteger(version.sequence) ||
          typeof version.modelHash !== "string" || this.hash(version.model) !== version.modelHash) {
        throw new Error("model_version_store_integrity_check_failed");
      }
    }
    this.versions = stored.versions.map(version => structuredClone(version));
    this.sequence = Math.max(...this.versions.map(version => version.sequence));
  }

  persist() {
    if (!this.storePath) return;
    const directory = path.dirname(this.storePath);
    fs.mkdirSync(directory, { recursive: true });
    const tempPath = this.storePath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify({ schemaVersion: 1, versions: this.versions }, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, this.storePath);
  }

  list() {
    return this.versions.map(({ model, ...metadata }) => ({ ...metadata }));
  }

  get(id) {
    const version = this.versions.find(item => item.id === id);
    if (!version) return null;
    return structuredClone(version);
  }

  create({ model, rationale, changeType = "update", evidenceRefs = [] } = {}) {
    if (!model || typeof model !== "object" || Array.isArray(model)) {
      const error = new Error("model_object_required");
      error.statusCode = 400;
      throw error;
    }
    if (typeof rationale !== "string" || rationale.trim().length < 8) {
      const error = new Error("rationale_required_min_8_chars");
      error.statusCode = 400;
      throw error;
    }
    if (!Array.isArray(evidenceRefs) || evidenceRefs.some(ref => typeof ref !== "string" || !ref.trim())) {
      const error = new Error("evidence_refs_must_be_nonempty_strings");
      error.statusCode = 400;
      throw error;
    }

    const previous = this.versions[this.versions.length - 1];
    const snapshot = structuredClone(model);
    const sequence = this.sequence + 1;
    const version = {
      id: `model-v${sequence}`,
      sequence,
      parentId: previous.id,
      createdAt: new Date().toISOString(),
      rationale: rationale.trim(),
      changeType: String(changeType || "update").trim().slice(0, 80),
      model: snapshot,
      modelHash: this.hash(snapshot),
      evidenceRefs: [...new Set(evidenceRefs)]
    };
    this.versions.push(version);
    this.sequence = sequence;
    try {
      this.persist();
    } catch (error) {
      this.versions.pop();
      this.sequence -= 1;
      throw error;
    }
    return structuredClone(version);
  }
}

module.exports = { VersionHistory };
