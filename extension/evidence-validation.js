export function validateCctvEvidence({source,response,payload,capturedAt}) {
  const timestampValid = value => typeof value === "string" && !Number.isNaN(Date.parse(value));
  const sha256Valid = value => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
  const snapshotRecord = {
    source: typeof source === "string" && /^https:\/\//i.test(source),
    timestamp: timestampValid(capturedAt),
    httpStatus: Number.isInteger(response?.status) && response.status >= 200 && response.status < 300,
    contentType: /application\/json/i.test(response?.headers?.get?.("content-type") || ""),
    payload: !!payload && typeof payload === "object" && !Array.isArray(payload),
    configured: payload?.status === "configured",
    snapshotVerified: payload?.snapshotStatus === "verified",
    snapshotContentType: /^image\/(?:jpeg|png|webp)$/i.test(payload?.snapshotContentType || ""),
    snapshotByteLength: Number.isSafeInteger(payload?.snapshotByteLength) && payload.snapshotByteLength > 0,
    snapshotSha256: sha256Valid(payload?.snapshotSha256),
    snapshotTimestamp: timestampValid(payload?.snapshotCheckedAt)
  };
  const promotion = {
    streamVerified: payload?.streamStatus === "verified",
    proxyVerified: payload?.proxyStatus === "verified",
    frameVerified: payload?.frame?.verified === true && sha256Valid(payload?.frame?.sha256),
    frameTimestamp: timestampValid(payload?.frame?.capturedAt)
  };
  const snapshotRecordValid = Object.values(snapshotRecord).every(Boolean);
  const promotionReady = snapshotRecordValid && Object.values(promotion).every(Boolean);
  return {
    // Preserve fail-closed behavior for existing callers that use "valid" as the promotion gate.
    valid: promotionReady,
    snapshotRecordValid,
    promotionReady,
    checks: { ...snapshotRecord, ...promotion }
  };
}
