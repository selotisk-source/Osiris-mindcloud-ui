function createLiveLiveness() {
  function evaluate({ routeOptions = [], riskState = {}, routeHistory = [], constraints = {}, situationalState = {} } = {}) {
    const selection = this.routeSelector({ routeOptions, riskState, history: routeHistory, constraints });
    const activeRouteId = situationalState.activeRouteId || null;
    const selectedId = selection.selectedRouteId || null;
    const changed = Boolean(selectedId && activeRouteId && selectedId !== activeRouteId);
    return {
      type: "live_liveness_route_state",
      activeRouteId,
      recommendedRouteId: selectedId,
      routeChanged: changed,
      selection,
      trigger: changed ? "situational-change" : "no-change-required",
      humanApprovalRequired: true,
      timestamp: new Date().toISOString()
    };
  }

  return { evaluate };
}

module.exports = { createLiveLiveness };
