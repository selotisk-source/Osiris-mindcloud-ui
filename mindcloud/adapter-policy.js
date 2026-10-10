const RETRY_SAFE_OPERATIONS = new Set([
  "health", "discover", "discover_tools", "query", "export_geojson", "resolve",
  "smart_search", "context", "browse", "navigate", "extract", "screenshot",
  "read", "find", "grep", "search_graph", "trace_path", "architecture",
  "impact_analysis", "list_projects", "list_skills", "search_skill", "search_database"
]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_ERROR = /(?:fetch failed|econnreset|econnrefused|ehostunreach|etimedout|eai_again|socket hang up|network error|temporarily unavailable|timed? out|browser_execution_failed|target page, context or browser has been closed|und_err_connect_timeout)/i;

function isRetrySafeOperation(operation) {
  return RETRY_SAFE_OPERATIONS.has(String(operation || ""));
}
function isTransientFailure(value) {
  if (!value || typeof value !== "object") return false;
  const statuses = [value.status,value.httpStatus,value.result?.status,value.result?.httpStatus]
    .map(Number).filter(Number.isFinite);
  if (statuses.some(status => RETRYABLE_HTTP_STATUSES.has(status))) return true;
  const detail = [value.error, value.message, value.result?.error, value.result?.message].filter(Boolean).join(" ");
  return TRANSIENT_ERROR.test(detail);
}
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function executeWithRetry(operation, execute, options = {}) {
  const safe = isRetrySafeOperation(operation);
  const maxAttempts = safe ? Math.max(1, Math.min(Number(options.maxAttempts) || 3, 3)) : 1;
  const baseDelayMs = Math.max(0, Math.min(Number(options.baseDelayMs ?? 150), 1000));
  const waitFn = options.waitFn || wait;
  let value;
  let attempts = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      value = await execute();
    } catch (error) {
      value = {ok:false,error:error instanceof Error ? error.message : String(error)};
    }
    if (attempt >= maxAttempts || !isTransientFailure(value)) break;
    await waitFn(baseDelayMs * (2 ** (attempt - 1)));
  }
  return {
    value,
    execution: {
      contractVersion: "1.0",
      attempts,
      retries: attempts - 1,
      retryPolicy: safe ? "transient-read-only" : "no-automatic-retry",
      recovered: attempts > 1 && Boolean(value?.ok)
    }
  };
}
module.exports = {RETRY_SAFE_OPERATIONS,isRetrySafeOperation,isTransientFailure,executeWithRetry};
