const { toolingCatalog } = require("../mindcore/catalog");

const recipes = [
  { id:"research-to-evidence", name:"Research → Evidence", layers:["Research","WebResearch","EvidenceIntegrity","Knowledge"], purpose:"Collect research, normalize findings and preserve provenance." },
  { id:"code-to-deploy", name:"Code → Verify → Deploy", layers:["CodeIntelligence","Development","HarnessEngineering"], purpose:"Inspect code, validate changes and promote a verified deployment." },
  { id:"signal-to-visual", name:"Signal → Analysis → Visual", layers:["Research","Visualization","GeoOSINT"], purpose:"Turn signals and evidence into an operator-facing visual state." },
  { id:"document-to-knowledge", name:"Document → Knowledge", layers:["Documents","Knowledge","KnowledgeAgent"], purpose:"Extract document content, structure it and attach evidence." },
  { id:"sensor-to-evidence", name:"Sensor → Evidence", layers:["SensorFabric","SpatialIntelligence","EvidenceCapture"], purpose:"Convert sensor observations into validated evidence artifacts." },
  { id:"planetary-situational-awareness", name:"Planetary Situation → Evidence → Spatial View", layers:["GeoOSINT","SensorFabric","SpatialIntelligence","EvidenceIntegrity","Knowledge"], purpose:"Combine validated geographic observations, live sensors and evidence into a time-aware spatial operator view while keeping simulation distinct from observation." }
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
