const MAX_INPUT_BYTES = 256 * 1024;
const MAX_DEPTH = 16;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

// These contracts describe the implemented native adapter surface. Provider-specific
// validation still runs in the adapter handler; this layer rejects malformed payloads
// before any network request or side effect can begin.
const CONTRACTS = Object.freeze({
  "overpass-turbo": {
    query: { required: ["query"], properties: { query: "string" }, maxBytes: 128 * 1024 },
    export_geojson: { required: ["query"], properties: { query: "string" }, maxBytes: 128 * 1024 }
  },
  "google-street-view": {
    metadata: { requiredAny: [["location", "pano"]], properties: { location: "string", pano: "string" } },
    image: { requiredAny: [["location", "pano"]], properties: { location: "string", pano: "string", size: "string", heading: "numberOrString", pitch: "numberOrString", fov: "numberOrString" } }
  },
  shodan: {
    host: { required: ["ip"], properties: { ip: "string" } },
    search: { required: ["query"], properties: { query: "string" } },
    dns: { required: ["domain"], properties: { domain: "string" } }
  },
  opensanctions: {
    search: { required: ["query"], properties: { query: "string", dataset: "string", limit: "number" } },
    match: { required: ["name"], properties: { name: "string", dataset: "string", schema: "string", birthDate: "stringOrStringArray", nationality: "stringOrStringArray", country: "stringOrStringArray", address: "stringOrStringArray" } }
  },
  "subdomain-finder": {
    discover: { required: ["domain"], properties: { domain: "string" } },
    resolve: { required: ["domain"], properties: { domain: "string", name: "string", type: "string" } }
  },
  mapillary: {
    search: { required: ["bbox"], properties: { bbox: "string", limit: "number" } },
    image: { required: ["id"], properties: { id: "stringOrNumber" } }
  },
  agentmemory: {
    remember: { requiredAny: [["content", "text", "observation"]], properties: { content: "string", text: "string", observation: "string", sessionId: "string", session_id: "string", datasetName: "string", dataset_name: "string" } },
    observe: { requiredAny: [["content", "text", "observation"]], properties: { content: "string", text: "string", observation: "string", sessionId: "string", session_id: "string", datasetName: "string", dataset_name: "string" } },
    smart_search: { requiredAny: [["query", "text", "context"]], properties: { query: "string", text: "string", context: "string", sessionId: "string", session_id: "string", limit: "number" } },
    context: { requiredAny: [["query", "text", "context"]], properties: { query: "string", text: "string", context: "string", sessionId: "string", session_id: "string", limit: "number" } }
  },
  ruflo: {
    discover_tools: { properties: {} }
  }
});

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function inspectValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return "input nesting exceeds limit";
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    if (typeof value === "number" && !Number.isFinite(value)) return "non-finite numbers are not allowed";
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > 1000) return "array exceeds item limit";
    for (const item of value) {
      const error = inspectValue(item, depth + 1);
      if (error) return error;
    }
    return null;
  }
  if (!isPlainObject(value)) return "input must contain only JSON-compatible values";
  for (const [key, item] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(key)) return "unsafe object key";
    const error = inspectValue(item, depth + 1);
    if (error) return error;
  }
  return null;
}

function matchesType(value, type) {
  switch (type) {
    case "string": return typeof value === "string" && value.trim().length > 0;
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "numberOrString": return (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.trim().length > 0);
    case "stringOrNumber": return (typeof value === "string" && value.trim().length > 0) || (typeof value === "number" && Number.isFinite(value));
    case "stringOrStringArray": return (typeof value === "string" && value.trim().length > 0) || (Array.isArray(value) && value.length > 0 && value.every(item => typeof item === "string" && item.trim().length > 0));
    default: return false;
  }
}

function validateAdapterInput(id, operation, input = {}) {
  if (input === undefined) input = {};
  if (!isPlainObject(input)) return { ok: false, error: "invalid_adapter_input", details: ["input must be a JSON object"] };
  let serialized;
  try { serialized = JSON.stringify(input); }
  catch { return { ok: false, error: "invalid_adapter_input", details: ["input must be JSON serializable"] }; }
  const byteLength = Buffer.byteLength(serialized || "{}", "utf8");
  const genericError = inspectValue(input);
  if (genericError) return { ok: false, error: "invalid_adapter_input", details: [genericError] };
  if (byteLength > MAX_INPUT_BYTES) return { ok: false, error: "adapter_input_too_large", maxBytes: MAX_INPUT_BYTES };

  const contract = CONTRACTS[id]?.[operation];
  if (!contract) return { ok: true, mode: "bounded-object", version: "1.0", bytes: byteLength };

  const details = [];
  const maxBytes = contract.maxBytes || MAX_INPUT_BYTES;
  if (byteLength > maxBytes) details.push("input exceeds operation payload limit");
  for (const key of contract.required || []) {
    if (!(key in input)) details.push("missing required field: " + key);
  }
  for (const group of contract.requiredAny || []) {
    if (!group.some(key => key in input && input[key] !== undefined && input[key] !== null && input[key] !== "")) {
      details.push("one of these fields is required: " + group.join(", "));
    }
  }
  for (const [key, value] of Object.entries(input)) {
    if (!(key in (contract.properties || {}))) {
      details.push("unknown field: " + key);
      continue;
    }
    if (value !== undefined && value !== null && !matchesType(value, contract.properties[key])) {
      details.push("invalid type or empty value for field: " + key);
    }
  }
  if (details.length) return { ok: false, error: "invalid_adapter_input", details, contractVersion: "1.0" };
  return { ok: true, mode: "typed", version: "1.0", bytes: byteLength };
}

module.exports = { validateAdapterInput, MAX_INPUT_BYTES, CONTRACTS };
