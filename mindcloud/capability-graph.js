const { modules = [] } = require("../integrations/tooling-catalog.json");

// The HTTP runtime runs directly on Node.js; consume the JSON registry rather
// than requiring catalog.ts, which Node.js 20 cannot load without a TS build.
const toolingCatalog = modules.map((item) => ({
  id: item.id,
  name: item.role || item.id,
  layer: item.mindcloud_layer || "Unclassified",
  status: item.status || "registered"
}));

const recipes = [
  { id:"research-to-evidence", name:"Research → Evidence", layers:["Research","WebResearch","EvidenceIntegrity","Knowledge"], purpose:"Collect research, normalize findings and preserve provenance." },
  { id:"code-to-deploy", name:"Code → Verify → Deploy", layers:["CodeIntelligence","Development","HarnessEngineering"], purpose:"Inspect code, validate changes and promote a verified deployment." },
  { id:"signal-to-visual", name:"Signal → Analysis → Visual", layers:["Research","Visualization","GeoOSINT"], purpose:"Turn signals and evidence into an operator-facing visual state." },
  { id:"document-to-knowledge", name:"Document → Knowledge", layers:["Documents","Knowledge","KnowledgeAgent"], purpose:"Extract document content, structure it and attach evidence." },
  { id:"sensor-to-evidence", name:"Sensor → Evidence", layers:["SensorFabric","SpatialIntelligence","EvidenceCapture"], purpose:"Convert sensor observations into validated evidence artifacts." }
];

function capabilitiesByLayer() {
  return toolingCatalog.reduce((acc, item) => {
    (acc[item.layer] ||= []).push({id:item.id,name:item.name,status:item.status});
    return acc;
  }, {});
}

function suggest(task={}) {
  const text = String(task.goal || task.kind || "").toLowerCase();
  const scored = recipes.map(recipe => ({
    ...recipe,
    score: recipe.layers.reduce((n, layer) => n + (text.includes(layer.toLowerCase()) ? 2 : 0), 0)
  })).sort((a,b)=>b.score-a.score);
  return {goal: task.goal || task.kind || "general", recipes: scored.slice(0,3)};
}

module.exports = { capabilitiesByLayer, suggest, recipes };
