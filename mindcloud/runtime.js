const { createRouterNetwork } = require("../mindcore/router-network");
const { capabilitiesByLayer, suggest, recipes } = require("./capability-graph");
const { VersionHistory } = require("./version-history");

class MindCloudRuntime {
  constructor() {
    this.network = createRouterNetwork();
    this.tasks = new Map();
    this.events = [];
    this.versionHistory = new VersionHistory({ name: "mindcore-model", state: { status: "baseline" } });
  }

  snapshot() {
    return {
      type: "mindcloud_runtime",
      health: "ok",
      topology: this.network.snapshot(),
      tasks: [...this.tasks.values()],
      modelVersions: this.versionHistory.list(),
      eventCount: this.events.length,
      capabilityLayers: capabilitiesByLayer(),
      recipes
    };
  }

  route(task) {
    const routed = this.network.route(task);
    const record = {
      taskId: routed.taskId || task.taskId || null,
      kind: routed.kind,
      status: "routed",
      route: routed,
      composition: suggest(task),
      createdAt: routed.routedAt
    };
    if (record.taskId) this.tasks.set(record.taskId, record);
    this.events.push({
      taskId: record.taskId,
      type: "complete",
      timestamp: new Date().toISOString(),
      source: "MindCloudRuntime",
      data: { action: "route", target: routed.target, recipes: record.composition.recipes.map(r => r.id) }
    });
    return record;
  }

  createModelVersion(input) {
    const version = this.versionHistory.create(input);
    this.events.push({
      taskId: null,
      type: "model_version_created",
      timestamp: version.createdAt,
      source: "MindCloudRuntime",
      data: { versionId: version.id, parentId: version.parentId, rationale: version.rationale, modelHash: version.modelHash, evidenceRefs: version.evidenceRefs }
    });
    return version;
  }

  eventsFor(taskId) {
    return taskId ? this.events.filter(event => event.taskId === taskId) : [...this.events];
  }
}

module.exports = { MindCloudRuntime };
