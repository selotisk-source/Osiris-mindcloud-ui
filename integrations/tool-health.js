const fs = require("node:fs");
const path = require("node:path");

const registryPath = path.join(__dirname, "agent-tools.json");
const adapterCandidates = id => [
  path.join(__dirname, "adapters", String(id).replace(/[^a-zA-Z0-9._-]/g, "-") + ".js"),
  path.join(__dirname, String(id).replace(/[^a-zA-Z0-9._-]/g, "-") + "-adapter.js")
];

function loadRegistry() {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  return Array.isArray(registry.tools) ? registry.tools : [];
}

function inspectTool(tool) {
  const candidates = adapterCandidates(tool.id);
  const adapter = candidates.find(file => fs.existsSync(file)) || null;
  const declaredOperations = Array.isArray(tool.operations) ? tool.operations : [];
  let executable = false;
  let loadError = null;
  if (adapter) {
    try {
      const loaded = require(adapter);
      executable = typeof loaded.execute === "function";
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error);
    }
  }
  let status = "DISCOVERY-ONLY";
  if (executable) status = "IMPLEMENTED";
  else if (adapter && !loadError) status = "ADAPTER-PRESENT";
  else if (tool.status === "adapter-ready") status = "PLANNED";
  return {
    ...tool,
    status,
    executable,
    adapter: adapter ? path.relative(path.join(__dirname, ".."), adapter) : null,
    operations: declaredOperations,
    loadError
  };
}

function inspectAll() {
  const tools = loadRegistry().map(inspectTool);
  return {
    type: "mindcloud_tool_implementation_status",
    policy: "Registry membership never implies execution. IMPLEMENTED requires a loadable adapter exporting execute().",
    counts: {
      total: tools.length,
      implemented: tools.filter(t => t.status === "IMPLEMENTED").length,
      adapterPresent: tools.filter(t => t.status === "ADAPTER-PRESENT").length,
      planned: tools.filter(t => t.status === "PLANNED").length,
      discoveryOnly: tools.filter(t => t.status === "DISCOVERY-ONLY").length
    },
    tools
  };
}

module.exports = { inspectAll, inspectTool };
