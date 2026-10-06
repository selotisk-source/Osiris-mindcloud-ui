const { createGRPO } = require("./grpo");
const { createMonteCarlo } = require("./monte-carlo");
const { createBestOfN } = require("./best-of-n");
const { createProcessRewardModel } = require("./process-reward-model");
const { createTimeComputeScaling } = require("./time-compute-scaling");
const { createSituationalAwareness } = require("./situational-awareness");
const { createRecursiveSelfImprovement } = require("./recursive-self-improvement");
const { createReasoningOrchestrator } = require("./reasoning-orchestrator");
const { createInContextLearning } = require("./in-context-learning");
const { createPPO } = require("./ppo");
const { createMonteCarloTreeResearch } = require("./monte-carlo-tree-research");

const STATIONS = [
  { id: "station-1", name: "Coordinator", role: "MindCore", accepts: ["orchestration","routing","general"] },
  { id: "station-2", name: "GEO / Heritage", role: "Geo", accepts: ["geo","heritage","map","evidence"] },
  { id: "station-3", name: "Sensor Fabric", role: "Sensors", accepts: ["sensor","camera","iot","telemetry"] },
  { id: "station-4", name: "Research / Work", role: "R&D", accepts: ["research","document","tool","analysis"] }
];

function createRouterNetwork() {
  const routes = new Map();
  const grpo = createGRPO();
  const monteCarlo = createMonteCarlo();
  const bestOfN = createBestOfN();
  const processRewardModel = createProcessRewardModel();
  const timeComputeScaling = createTimeComputeScaling();
  const situationalAwareness = createSituationalAwareness();
  const recursiveSelfImprovement = createRecursiveSelfImprovement();
  const reasoningOrchestrator = createReasoningOrchestrator();
  const inContextLearning = createInContextLearning();
  const ppo = createPPO();
  const monteCarloTreeResearch = createMonteCarloTreeResearch();
  for (const station of STATIONS) routes.set(station.id, new Set(STATIONS.filter(s => s.id !== station.id).map(s => s.id)));

  function route(task = {}) {
    const kind = String(task.kind || "general").toLowerCase();
    let target = STATIONS.find(s => s.accepts.includes(kind)) || STATIONS[0];
    return {
      taskId: task.taskId || null,
      kind,
      target: target.id,
      targetName: target.name,
      next: [...(routes.get(target.id) || [])],
      routedAt: new Date().toISOString()
    };
  }

  function snapshot() {
    return {
      stations: STATIONS.map(s => ({...s, neighbors: [...(routes.get(s.id) || [])]})),
      topology: "full-mesh",
      coordinator: "station-1"
    };
  }

  return { route, snapshot, grpo, monteCarlo, monteCarloTreeResearch, bestOfN, processRewardModel, timeComputeScaling, situationalAwareness, recursiveSelfImprovement, reasoningOrchestrator, inContextLearning, ppo };
}

module.exports = { createRouterNetwork };
