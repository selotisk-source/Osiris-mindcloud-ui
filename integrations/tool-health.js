const fs = require("node:fs");
const path = require("node:path");

const registryPath = path.join(__dirname, "agent-tools.json");
const adapterDir = path.join(__dirname, "adapters");

function loadRegistry() {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  return Array.isArray(registry.tools) ? registry.tools : [];
}

function adapterPath(id) {
  return path.join(adapterDir, String(id).replace(/[^a-zA-Z0-9._-]/g, "-") + ".js");
}

function inspectTool(tool) {
  const file = adapterPath(tool.id);
  const hasAdapter = fs.existsSync(file);
  const declaredOperations = Array.isArray(tool.operations) ? tool.operations : [];
  if (hasAdapter) {
    return {
      ...tool,
      implementationStatus: "implemented",
      executable: true,
      adapter: path.relative(path.join(__dirname, ".."), file),
      operations: declaredOperations
    };
  }
  return {
    ...tool,
    implementationStatus: "unimplemented",
    executable: false,
    adapter: null,
    operations: declaredOperations
  };
}

function inspectAll() {
  const tools = loadRegistry().map(inspectTool);
  return {
    type: "mindcloud_tool_implementation_status",
    policy: "A registry record never implies execution. Only a present adapter with declared operations is executable.",
    counts: {
      total: tools.length,
      implemented: tools.filter(t => t.implementationStatus === "implemented").length,
      unimplemented: tools.filter(t => t.implementationStatus === "unimplemented").length
    },
    tools
  };
}

module.exports = { inspectAll, inspectTool };
