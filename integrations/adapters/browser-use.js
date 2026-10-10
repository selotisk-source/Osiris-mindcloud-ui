const SERVICE_URL = (process.env.BROWSER_USE_SERVICE_URL || "").replace(/\/$/, "");

function requireService() {
  if (!SERVICE_URL) {
    const error = new Error("browser_use_service_not_configured");
    error.code = "NOT_CONFIGURED";
    throw error;
  }
  return SERVICE_URL;
}

async function execute(operation, input = {}) {
  const service = requireService();
  const response = await fetch(service + "/execute", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({operation, input}),
    signal: AbortSignal.timeout(Number(process.env.BROWSER_USE_TIMEOUT_MS || 15000))
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = {raw:text}; }
  if (!response.ok) {
    const error = new Error("browser_use_service_error");
    error.code = "REMOTE_ERROR";
    error.httpStatus = response.status;
    error.details = data;
    throw error;
  }
  return {tool:"browser-use", operation, status:"verified", data};
}

async function health() {
  const service = requireService();
  const response = await fetch(service + "/health", {signal:AbortSignal.timeout(2500)});
  return {status: response.ok ? "healthy" : "degraded", httpStatus: response.status, endpoint: service};
}

module.exports = {
  id: "browser-use",
  mode: "remote-execution-bridge",
  policy: "No browser session, credentials, or computer-use authority is assumed. The configured Browser Use service owns execution.",
  execute,
  health
};
