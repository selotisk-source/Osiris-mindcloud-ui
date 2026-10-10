const EVENT_TYPES = new Set(["partial_transcript", "final_transcript", "status", "error"]);
const STATUS_VALUES = new Set(["idle", "requesting_permission", "listening", "processing", "stopped", "permission_denied", "model_unavailable", "provider_error"]);

function validateSpeechEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return { ok: false, error: "invalid_speech_event", details: ["event must be an object"] };
  }
  const allowed = new Set(["session_id", "sequence", "event_type", "text", "locale", "start_ms", "end_ms", "provider", "timestamp", "status", "error_code"]);
  const unknown = Object.keys(event).filter(key => !allowed.has(key));
  if (unknown.length) return { ok: false, error: "invalid_speech_event", details: ["unknown fields: " + unknown.join(", ")] };
  const details = [];
  if (typeof event.session_id !== "string" || !event.session_id.trim()) details.push("session_id must be a non-empty string");
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) details.push("sequence must be a non-negative safe integer");
  if (!EVENT_TYPES.has(event.event_type)) details.push("event_type is unsupported");
  if (typeof event.provider !== "string" || !event.provider.trim()) details.push("provider must be a non-empty string");
  if (typeof event.timestamp !== "string" || !Number.isFinite(Date.parse(event.timestamp))) details.push("timestamp must be an ISO-compatible date string");
  if (event.locale !== undefined && (typeof event.locale !== "string" || !/^[a-z]{2,3}(?:-[A-Z0-9]{2,8})*$/.test(event.locale))) details.push("locale must be a BCP-47-like language tag");
  if (event.event_type === "partial_transcript" || event.event_type === "final_transcript") {
    if (typeof event.text !== "string") details.push("transcript events require text");
    if (!Number.isFinite(event.start_ms) || event.start_ms < 0) details.push("start_ms must be non-negative");
    if (!Number.isFinite(event.end_ms) || event.end_ms < event.start_ms) details.push("end_ms must be >= start_ms");
  } else if (event.text !== undefined) {
    details.push("text is only permitted on transcript events");
  }
  if (event.event_type === "status" && !STATUS_VALUES.has(event.status)) details.push("status event requires a supported status");
  if (event.event_type === "error" && (typeof event.error_code !== "string" || !event.error_code.trim())) details.push("error event requires error_code");
  if (details.length) return { ok: false, error: "invalid_speech_event", details };
  return { ok: true, version: "1.0", event: { ...event } };
}

module.exports = { validateSpeechEvent, EVENT_TYPES: [...EVENT_TYPES], STATUS_VALUES: [...STATUS_VALUES] };
