const SERVICE_URL = (process.env.BROWSER_USE_SERVICE_URL || "").replace(/\/$/, "");
const SERVICE_TOKEN = process.env.BROWSER_USE_API_KEY || "";
const ALLOWED = new Set(["browse", "navigate", "click", "type", "extract", "screenshot"]);

function requireService() {
  if (!SERVICE_URL) {
    const error = new Error("browser_use_service_not_configured");
    error.code = "NOT_CONFIGURED";
    throw error;
  }
  return SERVICE_URL;
}

async function request(path, options = {}, timeout = 15000) {
  const service = requireService();
  const headers = {"content-type":"application/json", ...(SERVICE_TOKEN ? {"authorization": "Bearer " + SERVICE_TOKEN} : {}), ...(options.headers || {})};
  const response = await fetch(service + path, {...options, headers, signal:AbortSignal.timeout(timeout)});
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {raw}; }
  if (!response.ok) {
    const error = new Error("browser_use_service_error");
    error.code = "REMOTE_ERROR";
    error.httpStatus = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function execute(operation, input = {}) {
  if (!ALLOWED.has(operation)) {
    const error = new Error("unsupported_browser_use_operation");
    error.code = "INVALID_OPERATION";
    throw error;
  }
  const task = typeof input.task === "string" ? input.task : ({
    browse: "Browse the supplied URL and report the requested findings.",
    navigate: "Navigate to the supplied URL and report the resulting page state.",
    click: "On the supplied page, click the specified element and report the result.",
    type: "On the supplied page, enter the supplied text in the specified field and report the result.",
    extract: "Extract the requested information from the supplied URL or current page.",
    screenshot: "Capture a screenshot of the supplied URL and report the result."
  })[operation];
  const result = await request("/v1/run", {
    method:"POST",
    body:JSON.stringify({task, instructions: JSON.stringify(input), max_steps: Number(process.env.BROWSER_USE_MAX_STEPS || 15)})
  }, Number(process.env.BROWSER_USE_TIMEOUT_MS || 60000));
  return {tool:"browser-use", operation, status:"executed", result};
}

async function health() {
  const data = await request("/health", {method:"GET"}, 3000);
  return {status:"healthy", endpoint:SERVICE_URL, result:data};
}

module.exports = {
  id:"browser-use",
  mode:"http-rest-bridge",
  policy:"Uses Browser Use self-hosted REST API /v1/run. Never supply secrets in task input. Execution requires a configured endpoint and model-provider credentials on the Browser Use service.",
  execute,
  health
};
