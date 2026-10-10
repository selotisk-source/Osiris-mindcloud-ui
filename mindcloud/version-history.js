const crypto = require("node:crypto");

class VersionHistory {
  constructor(initialModel = { name: "mindcore-model", state: {} }) {
    this.sequence = 1;
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
  }

  hash(value) {
    return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
    const sequence = ++this.sequence;
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
    return structuredClone(version);
  }
}

module.exports = { VersionHistory };
