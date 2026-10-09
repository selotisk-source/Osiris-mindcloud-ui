(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MindCloudEvidenceValidation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_ORIGIN = "https://osiris-mindcloud.up.railway.app";

  function validateEvidence(evidence, expectedOrigin = DEFAULT_ORIGIN) {
    const payload = evidence && evidence.payload;
    let sourceUrl = null;
    try { sourceUrl = new URL(evidence && evidence.source); } catch {}
    const checks = [
      { id: "evidence-id", label: "Evidence ID present", passed: typeof evidence?.evidenceId === "string" && evidence.evidenceId.trim().length > 0 },
      { id: "source", label: "Approved HTTPS CCTV endpoint", passed: !!sourceUrl && sourceUrl.origin === expectedOrigin && sourceUrl.protocol === "https:" && !sourceUrl.username && !sourceUrl.password && sourceUrl.pathname === "/api/cctv" && !sourceUrl.search && !sourceUrl.hash },
      { id: "timestamp", label: "Capture timestamp valid", passed: typeof evidence?.capturedAt === "string" && Number.isFinite(Date.parse(evidence.capturedAt)) },
      { id: "http", label: "HTTP response successful", passed: Number.isInteger(evidence?.httpStatus) && evidence.httpStatus >= 200 && evidence.httpStatus < 300 && evidence.ok === true },
      { id: "content-type", label: "JSON content type", passed: typeof evidence?.contentType === "string" && evidence.contentType.toLowerCase().includes("application/json") },
      { id: "payload", label: "OSIRIS CCTV payload shape", passed: !!payload && typeof payload === "object" && !Array.isArray(payload) && payload.service === "osiris-mindcloud-ui" && payload.endpoint === "/api/cctv" && ["configured", "not_configured"].includes(payload.status) && ["configured", "unconfigured"].includes(payload.streamStatus) && ["implemented", "not_implemented"].includes(payload.proxyStatus) }
    ];
    const responseValid = checks.every(check => check.passed);
    const streamReady = responseValid && payload.status === "configured" && payload.proxyStatus === "implemented" && evidence?.streamProof?.verified === true;
    return {
      checks,
      responseValid,
      streamReady,
      readyForHumanReview: responseValid && streamReady,
      summary: !responseValid
        ? "BLOCKED — one or more source/response provenance checks failed."
        : streamReady
          ? "Response and separate stream proof validated; human review is still required."
          : "Response provenance validated; live-stream proof is absent, so promotion remains blocked."
    };
  }

  return { DEFAULT_ORIGIN, validateEvidence };
});
