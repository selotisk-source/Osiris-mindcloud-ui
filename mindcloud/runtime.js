const fs = require("node:fs");
const path = require("node:path");
const { createRouterNetwork } = require("../mindcore/router-network");
const { capabilitiesByLayer, suggest, recipes } = require("./capability-graph");
const { VersionHistory } = require("./version-history");

class MindCloudRuntime {
  constructor(options = {}) {
    this.network = createRouterNetwork();
    this.storePath = options.storePath || process.env.MINDCLOUD_TASK_EVENT_STORE || "";
    this.tasks = new Map();
    this.events = [];
    this.versionHistory = new VersionHistory({ name: "mindcore-model", state: { status: "baseline" } });
    if (this.storePath && fs.existsSync(this.storePath)) this.loadTaskEventStore();
  }

  loadTaskEventStore() {
    let stored;
    try { stored = JSON.parse(fs.readFileSync(this.storePath, "utf8")); }
    catch { throw new Error("mindcloud_task_event_store_invalid_json"); }
    if (!stored || stored.schemaVersion !== 1 || !Array.isArray(stored.tasks) || !Array.isArray(stored.events)) {
      throw new Error("mindcloud_task_event_store_invalid_schema");
    }
    const taskIds = new Set();
    for (const task of stored.tasks) {
      if (!task || typeof task.taskId !== "string" || !task.taskId || taskIds.has(task.taskId)) {
        throw new Error("mindcloud_task_event_store_invalid_task");
      }
      taskIds.add(task.taskId);
    }
    for (const event of stored.events) {
      if (!event || typeof event.type !== "string" || typeof event.timestamp !== "string" ||
          (event.taskId !== null && typeof event.taskId !== "string")) {
        throw new Error("mindcloud_task_event_store_invalid_event");
      }
    }
    this.tasks = new Map(stored.tasks.map(task => [task.taskId, structuredClone(task)]));
    this.events = stored.events.map(event => structuredClone(event));
  }

  persistTaskEventStore() {
    if (!this.storePath) return;
    const directory = path.dirname(this.storePath);
    fs.mkdirSync(directory, { recursive: true });
    const tempPath = this.storePath + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify({
      schemaVersion: 1,
      tasks: [...this.tasks.values()],
      events: this.events
    }, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, this.storePath);
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
    const previous = record.taskId ? this.tasks.get(record.taskId) : null;
    const event = {
      taskId: record.taskId,
      type: "complete",
      timestamp: new Date().toISOString(),
      source: "MindCloudRuntime",
      data: { action: "route", target: routed.target, recipes: record.composition.recipes.map(r => r.id) }
    };
    if (record.taskId) this.tasks.set(record.taskId, record);
    this.events.push(event);
    try { this.persistTaskEventStore(); }
    catch (error) {
      this.events.pop();
      if (record.taskId) {
        if (previous) this.tasks.set(record.taskId, previous);
        else this.tasks.delete(record.taskId);
      }
      throw error;
    }
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
    try { this.persistTaskEventStore(); }
    catch (error) { this.events.pop(); throw error; }
    return version;
  }

  eventsFor(taskId) {
    return taskId ? this.events.filter(event => event.taskId === taskId) : [...this.events];
  }
}

module.exports = { MindCloudRuntime };
