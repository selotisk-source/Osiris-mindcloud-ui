function createSituationalAwareness(config = {}) {
  const historyLimit = Number.isInteger(config.historyLimit) ? Math.max(1, config.historyLimit) : 128;
  const history = [];

  function observe(input = {}) {
    const observation = {
      timestamp: new Date().toISOString(),
      state: input.state ?? {},
      events: Array.isArray(input.events) ? input.events : [],
      agents: Array.isArray(input.agents) ? input.agents : [],
      resources: input.resources ?? {},
      uncertainty: Number(input.uncertainty ?? 0)
    };
    history.push(observation);
    while (history.length > historyLimit) history.shift();

    const previous = history.length > 1 ? history[history.length - 2] : null;
    const changes = previous ? detectChanges(previous, observation) : [];

    return {
      module: "Emergent Situational Awareness",
      observation,
      changes,
      contextWindow: history.length,
      resultType: "situational_state"
    };
  }

  function detectChanges(previous, current) {
    const changes = [];
    if (JSON.stringify(previous.state) !== JSON.stringify(current.state)) changes.push("state_changed");
    if (current.events.length) changes.push("new_events");
    if (JSON.stringify(previous.agents) !== JSON.stringify(current.agents)) changes.push("agent_topology_changed");
    if (JSON.stringify(previous.resources) !== JSON.stringify(current.resources)) changes.push("resources_changed");
    if (current.uncertainty !== previous.uncertainty) changes.push("uncertainty_changed");
    return changes;
  }

  function snapshot() {
    return {
      module: "Emergent Situational Awareness",
      historyDepth: history.length,
      latest: history[history.length - 1] ?? null
    };
  }

  return { observe, snapshot };
}

module.exports = { createSituationalAwareness };
