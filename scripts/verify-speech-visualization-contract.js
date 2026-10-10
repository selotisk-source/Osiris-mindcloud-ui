#!/usr/bin/env node
const assert = require("node:assert/strict");
const { validateSpeechEvent } = require("../mindcloud/speech-visualization-contract");

const base = {
  session_id: "session-test-1",
  sequence: 0,
  event_type: "final_transcript",
  text: "Hello MindCloud",
  locale: "en-US",
  start_ms: 100,
  end_ms: 850,
  provider: "test-fixture",
  timestamp: "2026-10-10T18:00:00.000Z"
};
assert.equal(validateSpeechEvent(base).ok, true, "valid final transcript event should pass");
assert.equal(validateSpeechEvent({ ...base, event_type: "partial_transcript", sequence: 1 }).ok, true);
assert.equal(validateSpeechEvent({ ...base, session_id: "" }).ok, false, "empty session IDs must fail");
assert.equal(validateSpeechEvent({ ...base, sequence: -1 }).ok, false, "negative sequence numbers must fail");
assert.equal(validateSpeechEvent({ ...base, end_ms: 10 }).ok, false, "end time before start must fail");
assert.equal(validateSpeechEvent({ ...base, locale: "not a locale" }).ok, false, "malformed locale must fail");
assert.equal(validateSpeechEvent({ ...base, unexpected: true }).ok, false, "unknown fields must fail");
assert.equal(validateSpeechEvent({ ...base, event_type: "status", text: undefined, status: "listening", start_ms: undefined, end_ms: undefined }).ok, true);
assert.equal(validateSpeechEvent({ ...base, event_type: "status", text: undefined, status: "unrecognized", start_ms: undefined, end_ms: undefined }).ok, false);
assert.equal(validateSpeechEvent({ ...base, event_type: "error", text: undefined, error_code: "model_unavailable", start_ms: undefined, end_ms: undefined }).ok, true);
assert.equal(validateSpeechEvent({ ...base, event_type: "error", text: undefined, start_ms: undefined, end_ms: undefined }).ok, false);
console.log("speech-visualization-contract: verified typed events, transcript timing, locale, status/error events, and strict unknown-field rejection");
