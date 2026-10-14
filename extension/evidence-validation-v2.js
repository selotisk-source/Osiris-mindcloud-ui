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
    const mediaProtocol = String(payload?.mediaProtocol || "").toUpperCase();
    const responseChecks = {
      source: !!sourceUrl && sourceUrl.origin === expectedOrigin && sourceUrl.protocol === "https:" &&
        !sourceUrl.username && !sourceUrl.password && sourceUrl.pathname === "/api/cctv" &&
        !sourceUrl.search && !sourceUrl.hash,
      timestamp: timestampValid(capturedAt),
      httpStatus: Number.isInteger(response?.status) && response.status >= 200 && response.status < 300,
      contentType: /application\\/json/i.test(response?.headers?.get?.("content-type") || ""),
      payload: !!payload && typeof payload === "object" && !Array.isArray(payload),
      configured: payload?.status === "configured",
      mediaProtocolSupported: ["SNAPSHOT", "HLS", "DASH"].includes(mediaProtocol)
    };
    const snapshotChecks = {
      snapshotVerified: payload?.snapshotStatus === "verified",
      snapshotContentType: /^image\\/(?:jpeg|png|webp)$/i.test(payload?.snapshotContentType || ""),
      snapshotByteLength: Number.isSafeInteger(payload?.snapshotByteLength) && payload.snapshotByteLength > 0,
      snapshotSha256: sha256Valid(payload?.snapshotSha256),
      snapshotTimestamp: timestampValid(payload?.snapshotCheckedAt)
    };
    const streamChecks = {
      streamVerified: payload?.streamStatus === "verified",
      proxyVerified: payload?.proxyStatus === "verified",
      frameVerified: payload?.frame?.verified === true && sha256Valid(payload?.frame?.sha256),
      frameTimestamp: timestampValid(payload?.frame?.capturedAt)
    };
    const responseRecordValid = Object.values(responseChecks).every(Boolean);
    const snapshotRecordValid = responseRecordValid && mediaProtocol === "SNAPSHOT" && Object.values(snapshotChecks).every(Boolean);
    const liveStreamRecordValid = responseRecordValid && ["HLS", "DASH"].includes(mediaProtocol) && Object.values(streamChecks).every(Boolean);
    const promotionReady = liveStreamRecordValid;
    const checks = { ...responseChecks };
    if (mediaProtocol === "SNAPSHOT") Object.assign(checks, snapshotChecks, streamChecks);
    else if (["HLS", "DASH"].includes(mediaProtocol)) Object.assign(checks, streamChecks);
    else Object.assign(checks, snapshotChecks, streamChecks);
    return {
      valid: promotionReady,
      responseRecordValid,
      snapshotRecordValid,
      liveStreamRecordValid,
      promotionReady,
      mediaProtocol,
      checks
    };
  }

  return { DEFAULT_ORIGIN, validateCctvEvidence };
});
