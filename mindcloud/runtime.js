const { createRouterNetwork } = require("../mindcore/router-network");

class MindCloudRuntime {
  constructor() {
    this.network = createRouterNetwork();
    this.tasks = new Map();
    this.events = [];
  }

  snapshot() {
    return {
      type: "mindcloud_runtime",
      health: "ok",
      topology: this.network.snapshot(),
      tasks: [...this.tasks.values()],
      eventCount: this.events.length
    };
  }

  route(task) {
    const routed = this.network.route(task);
    const record = {
      taskId: routed.taskId || task.taskId || null,
      kind: routed.kind,
      status: "routed",
      route: routed,
      createdAt: routed.routedAt
    };
    if (record.taskId) this.tasks.set(record.taskId, record);
    this.events.push({
      taskId: record.taskId,
      type: "complete",
      timestamp: new Date().toISOString(),
      source: "MindCloudRuntime",
      data: { action: "route", target: routed.target }
    });
    return record;
  }

  eventsFor(taskId) {
    return taskId ? this.events.filter(event => event.taskId === taskId) : [...this.events];
  }
}

module.exports = { MindCloudRuntime };
