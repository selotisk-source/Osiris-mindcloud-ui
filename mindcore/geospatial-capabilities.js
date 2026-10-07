const CAPABILITIES = Object.freeze([
  { id: "geo-3d-context", name: "Geospatial 3D Context", domain: "geo", accepts: ["camera", "drone", "map"], outputs: ["spatial_model"], status: "available" },
  { id: "visibility-analysis", name: "Visibility / Sightline Analysis", domain: "geo", accepts: ["spatial_model", "observer", "target"], outputs: ["visibility_profile"], status: "available" },
  { id: "route-analysis", name: "Route & Accessibility Analysis", domain: "geo", accepts: ["spatial_model", "origin", "destination", "constraints"], outputs: ["route_options"], status: "available" },
  { id: "change-detection", name: "Temporal Change Detection", domain: "sensor", accepts: ["observations", "baseline"], outputs: ["changes"], status: "available" },
  { id: "sensor-fusion", name: "Sensor Fusion", domain: "sensor", accepts: ["observations"], outputs: ["fused_observation"], status: "available" },
  { id: "traffic-flow", name: "Traffic & Movement Analysis", domain: "sensor", accepts: ["observations"], outputs: ["flow_summary"], status: "available" },
  { id: "situational-layer", name: "Live Situational Layer", domain: "orchestration", accepts: ["fused_observation", "flow_summary", "changes"], outputs: ["situational_state"], status: "available" },
  { id: "wifi-rf-presence", name: "WiFi / RF Presence & Motion Sensing", domain: "sensor", accepts: ["rf_observations", "room_model"], outputs: ["presence_map", "motion_events"], status: "available", privacy: "authorized-environment-only" }
]);

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function createGeospatialCapabilities() {
  function list() {
    return CAPABILITIES.map(capability => ({ ...capability }));
  }

  function extract({ source = "unknown", location = null, observations = [] } = {}) {
    return {
      type: "spatial_observation",
      source,
      location,
      observationCount: Array.isArray(observations) ? observations.length : 0,
      capabilities: ["geo-3d-context", "sensor-fusion", "change-detection", "traffic-flow"]
    };
  }

  function fuse({ observations = [] } = {}) {
    const items = Array.isArray(observations) ? observations : [];
    const confidence = items.length ? items.reduce((sum, item) => sum + clamp01(item.confidence), 0) / items.length : 0;
    return {
      type: "fused_observation",
      observationCount: items.length,
      confidence,
      sources: [...new Set(items.map(item => item.source).filter(Boolean))],
      timestamp: new Date().toISOString()
    };
  }

  function detectChanges({ baseline = [], observations = [] } = {}) {
    const base = new Set((Array.isArray(baseline) ? baseline : []).map(item => item.id).filter(Boolean));
    const current = Array.isArray(observations) ? observations : [];
    return {
      type: "changes",
      added: current.filter(item => item.id && !base.has(item.id)).map(item => item.id),
      observedCount: current.length,
      baselineCount: base.size,
      timestamp: new Date().toISOString()
    };
  }

  function summarizeTraffic({ observations = [] } = {}) {
    const items = Array.isArray(observations) ? observations : [];
    const counts = {};
    for (const item of items) {
      const direction = String(item.direction || "unknown");
      counts[direction] = (counts[direction] || 0) + Number(item.count || 0);
    }
    return { type: "flow_summary", observationCount: items.length, counts, timestamp: new Date().toISOString() };
  }

  function analyzeWifiRF({ observations = [], roomModel = null, authorized = false } = {}) {
    if (!authorized) {
      return {
        type: "rf_sensing_denied",
        reason: "explicit authorization required",
        observationCount: 0
      };
    }
    const items = Array.isArray(observations) ? observations : [];
    const motionEvents = items.filter(item => item && item.motion === true).map(item => ({
      zone: item.zone || "unknown",
      confidence: clamp01(item.confidence),
      timestamp: item.timestamp || new Date().toISOString()
    }));
    return {
      type: "wifi_rf_presence",
      roomModel,
      observationCount: items.length,
      motionEventCount: motionEvents.length,
      motionEvents,
      outputScope: "presence-and-motion-zones",
      identityInference: false,
      timestamp: new Date().toISOString()
    };
  }

  function planCapabilities({ task = "situational-awareness", available = [] } = {}) {
    const requested = String(task).toLowerCase();
    const availableIds = new Set(available.length ? available : CAPABILITIES.map(item => item.id));
    const preferred = requested.includes("traffic")
      ? ["sensor-fusion", "traffic-flow", "change-detection", "situational-layer"]
      : requested.includes("geo") || requested.includes("map")
        ? ["geo-3d-context", "visibility-analysis", "route-analysis", "situational-layer"]
        : ["sensor-fusion", "change-detection", "situational-layer"];
    return preferred.filter(id => availableIds.has(id));
  }

  return { list, extract, fuse, detectChanges, summarizeTraffic, analyzeWifiRF, planCapabilities };
}

module.exports = { CAPABILITIES, createGeospatialCapabilities };
