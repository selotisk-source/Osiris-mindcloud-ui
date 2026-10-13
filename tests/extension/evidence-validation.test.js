const assert = require("node:assert/strict");
const { DEFAULT_ORIGIN, validateCctvEvidence } = require("../../extension/evidence-validation-v2.js");

const response = (status = 200, contentType = "application/json") => ({
  status,
  headers: { get: name => name.toLowerCase() === "content-type" ? contentType : null }
});
const snapshotPayload = () => ({
  status: "configured",
  snapshotStatus: "verified",
  snapshotContentType: "image/jpeg",
  snapshotByteLength: 64,
  snapshotSha256: "a".repeat(64),
  snapshotCheckedAt: "2026-10-13T05:00:00.000Z",
  streamStatus: "unverified",
  proxyStatus: "implemented",
  frame: { verified: false, sha256: null, capturedAt: null }
});
const liveProof = () => ({
  streamStatus: "verified",
  proxyStatus: "verified",
  frame: { verified: true, sha256: "b".repeat(64), capturedAt: "2026-10-13T05:00:01.000Z" }
});
function validate(overrides = {}) {
  return validateCctvEvidence({
    source: DEFAULT_ORIGIN + "/api/cctv",
    response: response(),
    payload: snapshotPayload(),
    capturedAt: "2026-10-13T05:00:02.000Z",
    ...overrides
  });
}

const snapshotOnly = validate();
assert.equal(snapshotOnly.snapshotRecordValid, true);
assert.equal(snapshotOnly.promotionReady, false);
assert.equal(snapshotOnly.valid, false, "snapshot-only evidence must not satisfy the live-stream gate");

const complete = validate({ payload: { ...snapshotPayload(), ...liveProof() } });
assert.equal(complete.snapshotRecordValid, true);
assert.equal(complete.promotionReady, true);
assert.equal(complete.valid, true, "complete stream/proxy/frame evidence should satisfy the contract");

const malformedSnapshotHash = validate({ payload: { ...snapshotPayload(), snapshotSha256: "not-a-sha256" } });
assert.equal(malformedSnapshotHash.snapshotRecordValid, false);
assert.equal(malformedSnapshotHash.promotionReady, false);

const malformedFrameHash = validate({
  payload: { ...snapshotPayload(), ...liveProof(), frame: { ...liveProof().frame, sha256: "xyz" } }
});
assert.equal(malformedFrameHash.snapshotRecordValid, true);
assert.equal(malformedFrameHash.promotionReady, false);

const invalidFrameTime = validate({
  payload: { ...snapshotPayload(), ...liveProof(), frame: { ...liveProof().frame, capturedAt: "not-a-date" } }
});
assert.equal(invalidFrameTime.promotionReady, false);

for (const source of [
  "http://mindcloud-live.up.railway.app/api/cctv",
  "https://attacker.example/api/cctv",
  DEFAULT_ORIGIN + "/api/cctv?debug=1",
  DEFAULT_ORIGIN + "/other"
]) {
  assert.equal(validate({ source }).snapshotRecordValid, false, "invalid source must fail closed: " + source);
}
assert.equal(validate({ response: response(503) }).snapshotRecordValid, false);
assert.equal(validate({ response: response(200, "text/plain") }).snapshotRecordValid, false);
assert.equal(validate({ payload: null }).snapshotRecordValid, false);
assert.equal(validate({ payload: { ...snapshotPayload(), snapshotByteLength: Number.MAX_SAFE_INTEGER + 1 } }).snapshotRecordValid, false);

console.log("evidence-validation: PASS — snapshot/live-frame separation, malformed hashes/timestamps, origin/path, HTTP/content-type and payload-shape cases");
