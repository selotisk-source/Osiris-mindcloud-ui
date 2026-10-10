const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

class EvidenceGraph {
  constructor(options = {}) {
    this.storePath = options.storePath || process.env.MINDCLOUD_EVIDENCE_GRAPH_STORE || "";
    this.nodes = new Map();
    this.edges = new Map();
    if (this.storePath && fs.existsSync(this.storePath)) this.load();
  }
  load() {
    let stored;
    try { stored = JSON.parse(fs.readFileSync(this.storePath, "utf8")); }
    catch { throw new Error("mindcloud_evidence_graph_invalid_json"); }
    if (!stored || stored.schemaVersion !== 1 || !Array.isArray(stored.nodes) || !Array.isArray(stored.edges)) {
      throw new Error("mindcloud_evidence_graph_invalid_schema");
    }
    const nodes = new Map();
    const edges = new Map();
    for (const node of stored.nodes) {
      if (!node || typeof node.id !== "string" || !node.id || nodes.has(node.id) ||
          typeof node.type !== "string" || typeof node.createdAt !== "string" ||
          typeof node.contentHash !== "string" || hash(node.content) !== node.contentHash) {
        throw new Error("mindcloud_evidence_graph_node_integrity_failed");
      }
      nodes.set(node.id, structuredClone(node));
    }
    for (const edge of stored.edges) {
      if (!edge || typeof edge.id !== "string" || !edge.id || edges.has(edge.id) ||
          !nodes.has(edge.from) || !nodes.has(edge.to) || typeof edge.relation !== "string" ||
          typeof edge.createdAt !== "string") {
        throw new Error("mindcloud_evidence_graph_edge_integrity_failed");
      }
      edges.set(edge.id, structuredClone(edge));
    }
    this.nodes = nodes;
    this.edges = edges;
  }
  persist() {
    if (!this.storePath) return;
    fs.mkdirSync(path.dirname(this.storePath), {recursive:true});
    const temp = this.storePath + ".tmp";
    fs.writeFileSync(temp, JSON.stringify({schemaVersion:1,nodes:[...this.nodes.values()],edges:[...this.edges.values()]},null,2), {mode:0o600});
    fs.renameSync(temp,this.storePath);
  }
  snapshot() {
    return {type:"mindcloud_evidence_graph",schemaVersion:1,nodes:[...this.nodes.values()].map(n=>structuredClone(n)),edges:[...this.edges.values()].map(e=>structuredClone(e)),nodeCount:this.nodes.size,edgeCount:this.edges.size};
  }
  addNode(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("evidence_node_object_required");
    const type = typeof input.type === "string" ? input.type.trim() : "";
    if (!type || type.length > 80) throw invalid("evidence_node_type_invalid");
    const content = input.content;
    if (!content || typeof content !== "object" || Array.isArray(content)) throw invalid("evidence_node_content_object_required");
    const label = typeof input.label === "string" ? input.label.trim().slice(0,200) : "";
    if (!label) throw invalid("evidence_node_label_required");
    const sourceRef = input.sourceRef === undefined ? null : input.sourceRef;
    if (sourceRef !== null && (typeof sourceRef !== "string" || !sourceRef.trim())) throw invalid("evidence_source_ref_invalid");
    const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : "evn-" + crypto.randomUUID();
    if (this.nodes.has(id)) throw invalid("evidence_node_id_conflict");
    const createdAt = new Date().toISOString();
    const node = {id,type,label,content:structuredClone(content),contentHash:hash(content),sourceRef:sourceRef ? sourceRef.trim() : null,createdAt};
    this.nodes.set(id,node);
    try { this.persist(); } catch (error) { this.nodes.delete(id); throw error; }
    return structuredClone(node);
  }
  addEdge(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("evidence_edge_object_required");
    const from = typeof input.from === "string" ? input.from.trim() : "";
    const to = typeof input.to === "string" ? input.to.trim() : "";
    const relation = typeof input.relation === "string" ? input.relation.trim() : "";
    if (!from || !to || !relation || relation.length > 100) throw invalid("evidence_edge_fields_invalid");
    if (!this.nodes.has(from) || !this.nodes.has(to)) throw invalid("evidence_edge_endpoint_not_found");
    const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : "eve-" + crypto.randomUUID();
    if (this.edges.has(id)) throw invalid("evidence_edge_id_conflict");
    const edge = {id,from,to,relation,createdAt:new Date().toISOString()};
    this.edges.set(id,edge);
    try { this.persist(); } catch (error) { this.edges.delete(id); throw error; }
    return structuredClone(edge);
  }
}
module.exports = { EvidenceGraph };
