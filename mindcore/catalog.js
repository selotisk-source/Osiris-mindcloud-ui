const fs = require("node:fs");
const path = require("node:path");

const registryPath = path.join(__dirname, "..", "integrations", "agent-tools.json");
let externalTools = [];
try {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  externalTools = Array.isArray(registry.tools) ? registry.tools : [];
} catch {
  externalTools = [];
}

const builtInTools = [
  { id: "mindcore-router", name: "MindCore Router", layer: "Orchestration", status: "runtime" },
  { id: "mindcloud-runtime", name: "MindCloud Runtime", layer: "Orchestration", status: "runtime" },
  { id: "geospatial-capabilities", name: "Geospatial Capabilities", layer: "GeoOSINT", status: "runtime" },
  { id: "live-liveness", name: "Live Liveness", layer: "SituationalAwareness", status: "runtime" },
  { id: "monte-carlo", name: "Monte Carlo", layer: "Reasoning", status: "runtime" },
  { id: "monte-carlo-tree-research", name: "Monte Carlo Tree Research", layer: "Research", status: "runtime" },
  { id: "process-reward-model", name: "Process Reward Model", layer: "Evaluation", status: "runtime" },
  { id: "recursive-self-improvement", name: "Recursive Self Improvement", layer: "Metanoia", status: "runtime" },
  { id: "reasoning-orchestrator", name: "Reasoning Orchestrator", layer: "Reasoning", status: "runtime" },
  { id: "situational-awareness", name: "Situational Awareness", layer: "SituationalAwareness", status: "runtime" }
];

const toolingCatalog = [
  ...builtInTools,
  ...externalTools.map(tool => ({
    id: String(tool.id || "unknown"),
    name: String(tool.name || tool.id || "Unnamed adapter"),
    layer: String(tool.layer || "ExternalAdapter"),
    status: String(tool.status || "registered"),
    source: tool.source || null,
    operations: Array.isArray(tool.operations) ? tool.operations : []
  }))
];

module.exports = { toolingCatalog };
