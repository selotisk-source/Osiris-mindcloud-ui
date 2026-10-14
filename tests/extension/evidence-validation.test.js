const assert = require("node:assert/strict");
const { DEFAULT_ORIGIN, validateCctvEvidence } = require("../../extension/evidence-validation-v2.js");

const response = (status = 200, contentType = "application/json") => ({
  status,
  headers: { get: name => name.toLowerCase() === "content-type" ? contentType : null }
});
const snapshotPayload = () => ({
  status: "configured",
  mediaProtocol: "SNAPSHOT",
  snapshotStatus: "verified",
  snapshotContentType: "image/jpeg",
  snapshotByteLength: 64,
  snapshotSha256: "a".repeat(64),
  snapshotCheckedAt: "2026-10-13T05:00:00.000Z",
  streamStatus: "unverified",
  proxyStatus: "implemented",
  frame: { verified: false, sha256: null, capturedAt: null }
});
const hlsPayload = (overrides = {}) => ({
  status: "configured",
  mediaProtocol: "HLS",
  snapshotStatus: "not_a_snapshot",
  streamStatus: "unverified",
  proxyStatus: "implemented",
  frame: { verified: false, sha256: null, capturedAt: null },
  ...overrides
});
const liveProof = () => ({
  streamStatus: "verified",
  proxyStatus: "verified",
  frame: { verified: true, sha256: "b".repeat(64), capturedAt: "2026-10-13T05:00:01.000Z" }
});
function validate(payload, overrides = {}) {
  return validateCctvEvidence({
    source: DEFAULT_ORIGIN + "/api/cctv",
    response: response(),
    payload,
    capturedAt: "2026-10-13T05:00:02.000Z",
    ...overrides
  });
}

const snapshotOnly = validate(snapshotPayload());
assert.equal(snapshotOnly.responseRecordValid, true);
assert.equal(snapshotOnly.snapshotRecordValid, true);
assert.equal(snapshotOnly.liveStreamRecordValid, false);
assert.equal(snapshotOnly.promotionReady, false, "snapshot-only evidence must not satisfy the live-stream gate");

const actualConfiguredHlsShape = validate(hlsPayload());
assert.equal(actualConfiguredHlsShape.responseRecordValid, true, "a valid HLS response must not fail merely because it is not a JPEG snapshot");
assert.equal(actualConfiguredHlsShape.snapshotRecordValid, false);
assert.equal(actualConfiguredHlsShape.liveStreamRecordValid, false, "configured HLS without frame proof must remain blocked");
assert.equal(actualConfiguredHlsShape.promotionReady, false);

const completeHls = validate(hlsPayload(liveProof()));
assert.equal(completeHls.responseRecordValid, true);
assert.equal(completeHls.snapshotRecordValid, false, "HLS proof must not depend on unrelated snapshot metadata");
assert.equal(completeHls.liveStreamRecordValid, true);
assert.equal(completeHls.promotionReady, true, "verified HLS/proxy/frame evidence should satisfy the live-stream contract");
assert.equal("snapshotVerified" in completeHls.checks, false, "HLS validation must not show irrelevant snapshot-only checks");

const malformedSnapshotHash = validate({ ...snapshotPayload(), snapshotSha256: "not-a-sha256" });
assert.equal(malformedSnapshotHash.snapshotRecordValid, false);
assert.equal(malformedSnapshotHash.promotionReady, false);

const malformedFrameHash = validate(hlsPayload({ ...liveProof(), frame: { ...liveProof().frame, sha256: "xyz" } }));
assert.equal(malformedFrameHash.liveStreamRecordValid, false);
assert.equal(malformedFrameHash.promotionReady, false);

const invalidFrameTime = validate(hlsPayload({ ...liveProof(), frame: { ...liveProof().frame, capturedAt: "not-a-date" } }));
assert.equal(invalidFrameTime.promotionReady, false);

for (const source of [
  "http://mindcloud-live.up.railway.app/api/cctv",
  "https://attacker.example/api/cctv",
  DEFAULT_ORIGIN + "/api/cctv?debug=1",
  DEFAULT_ORIGIN + "/other"
]) {
  assert.equal(validate(hlsPayload(liveProof()), { source }).promotionReady, false, "invalid source must fail closed: " + source);
}
assert.equal(validate(hlsPayload(liveProof()), { response: response(503) }).promotionReady, false);
assert.equal(validate(hlsPayload(liveProof()), { response: response(200, "text/plain") }).promotionReady, false);
assert.equal(validate(null).promotionReady, false);
const unknownProtocol = validate(hlsPayload({ ...liveProof(), mediaProtocol: "UNKNOWN" }));
assert.equal(unknownProtocol.responseRecordValid, false);
assert.equal(unknownProtocol.promotionReady, false);

console.log("evidence-validation: PASS — snapshot/live-stream contracts separated; HLS configured state stays blocked until proxy/frame proof; malformed hashes/timestamps, origin/path, HTTP/content-type and payload-shape cases fail closed");
