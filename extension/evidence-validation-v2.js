(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MindCloudEvidenceValidation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_ORIGIN = "https://mindcloud-live.up.railway.app";
  const timestampValid = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  const sha256Valid = value => typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);

  function validateCctvEvidence({ source, response, payload, capturedAt } = {}, expectedOrigin = DEFAULT_ORIGIN) {
    let sourceUrl = null;
    try { sourceUrl = new URL(source); } catch {}
    const snapshot = {
      source: !!sourceUrl && sourceUrl.origin === expectedOrigin && sourceUrl.protocol === "https:" &&
        !sourceUrl.username && !sourceUrl.password && sourceUrl.pathname === "/api/cctv" &&
        !sourceUrl.search && !sourceUrl.hash,
      timestamp: timestampValid(capturedAt),
      httpStatus: Number.isInteger(response?.status) && response.status >= 200 && response.status < 300,
      contentType: /application\\/json/i.test(response?.headers?.get?.("content-type") || ""),
      payload: !!payload && typeof payload === "object" && !Array.isArray(payload),
      configured: payload?.status === "configured",
      snapshotVerified: payload?.snapshotStatus === "verified",
      snapshotContentType: /^image\\/(?:jpeg|png|webp)$/i.test(payload?.snapshotContentType || ""),
      snapshotByteLength: Number.isSafeInteger(payload?.snapshotByteLength) && payload.snapshotByteLength > 0,
      snapshotSha256: sha256Valid(payload?.snapshotSha256),
      snapshotTimestamp: timestampValid(payload?.snapshotCheckedAt)
    };
    const stream = {
      streamVerified: payload?.streamStatus === "verified",
      proxyVerified: payload?.proxyStatus === "verified",
      frameVerified: payload?.frame?.verified === true && sha256Valid(payload?.frame?.sha256),
      frameTimestamp: timestampValid(payload?.frame?.capturedAt)
    };
    const snapshotRecordValid = Object.values(snapshot).every(Boolean);
    const promotionReady = snapshotRecordValid && Object.values(stream).every(Boolean);
    return { valid: promotionReady, snapshotRecordValid, promotionReady, checks: { ...snapshot, ...stream } };
  }

  return { DEFAULT_ORIGIN, validateCctvEvidence };
});
