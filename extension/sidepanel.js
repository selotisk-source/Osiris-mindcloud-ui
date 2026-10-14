const validationApi = globalThis.MindCloudEvidenceValidation;
if (!validationApi) throw new Error("MindCloud evidence validator failed to load");
const base = validationApi.DEFAULT_ORIGIN;
const byId = id => document.getElementById(id);

byId("open").addEventListener("click", () => chrome.tabs.create({ url: base }));

byId("inspectTab").addEventListener("click", async () => {
  const output = byId("tabMetadata");
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) throw new Error("No active tab URL available");
    const url = new URL(tab.url);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP/HTTPS tabs are supported");
    output.textContent = JSON.stringify({
      title: tab.title || "",
      url: url.href,
      origin: url.origin,
      hostname: url.hostname,
      observedAt: new Date().toISOString(),
      cookiesRead: false,
      pageContentRead: false,
      networkTransfer: false
    }, null, 2);
  } catch (error) {
    output.textContent = String(error?.message || error);
  }
});

function renderValidation(result) {
  const summary = byId("evidenceValidation");
  const list = byId("validationChecks");
  const gate = byId("promotionGate");
  summary.textContent = result.liveStreamRecordValid
    ? "Live-stream evidence validated."
    : result.snapshotRecordValid
      ? "Snapshot record validated."
      : result.responseRecordValid
        ? "CCTV response received; media evidence is incomplete."
        : "CCTV response failed validation.";
  list.replaceChildren();
  for (const [name, passed] of Object.entries(result.checks)) {
    const item = document.createElement("li");
    item.className = passed ? "check-pass" : "check-fail";
    item.textContent = (passed ? "PASS — " : "FAIL — ") + name;
    list.appendChild(item);
  }
  gate.textContent = result.promotionReady
    ? "LIVE-STREAM CONTRACT SATISFIED — human review still required; no automatic promotion."
    : "BLOCKED — live-stream/proxy/frame proof is incomplete; no promotion.";
}

byId("probe").addEventListener("click", async () => {
  const verification = byId("verification");
  const evidenceId = byId("evidenceId");
  const id = crypto.randomUUID();
  const source = base + "/api/cctv";
  evidenceId.textContent = id;
  verification.textContent = "Requesting /api/cctv…";
  try {
    const response = await fetch(source, { method: "GET", headers: { accept: "application/json" }, cache: "no-store" });
    const text = await response.text();
    let payload;
    let parseError = false;
    try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 1000) }; parseError = true; }
    const capturedAt = new Date().toISOString();
    const evidence = {
      evidenceId: id, source, capturedAt, httpStatus: response.status, ok: response.ok,
      contentType: response.headers.get("content-type") || "", payload, parseError, streamProof: null
    };
    const validation = validationApi.validateCctvEvidence({ source, response, payload, capturedAt });
    verification.textContent = JSON.stringify({ evidence, validation }, null, 2);
    renderValidation(validation);
  } catch (error) {
    const capturedAt = new Date().toISOString();
    const evidence = { evidenceId: id, source, capturedAt, httpStatus: 0, ok: false, error: String(error?.message || error), streamProof: null };
    verification.textContent = JSON.stringify(evidence, null, 2);
    renderValidation(validationApi.validateCctvEvidence({
      source, response: { status: 0, headers: { get: () => "" } }, payload: null, capturedAt
    }));
  }
});
