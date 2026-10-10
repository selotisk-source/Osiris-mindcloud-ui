const SOURCE = "https://sael.net/gigacity/#seed=4417&sky=day&view=chase&at=258.2,107.3,0.0&look=90,-5";

function describe() {
  return {
    id: "gigacity-spatial",
    name: "Gigacity Spatial View",
    layer: "SpatialIntelligence",
    status: "registered",
    source: SOURCE,
    mode: "external-interactive-3d",
    capabilities: ["spatial-visualization", "procedural-city", "webgpu"],
    routes: ["GodsEye", "HeritageMap", "SpatialIntelligence"],
    sensorFabric: { status: "not-a-sensor-source", reason: "The source is a visualization surface, not a verified camera/sensor stream." },
    policy: "read-only-adapter; no undocumented endpoint extraction; promote only after runtime verification"
  };
}

module.exports = { SOURCE, describe };
