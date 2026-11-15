"use strict";

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function configuration(env = process.env) {
  const rawBase = String(env.HERMES_SERVICE_URL || "").trim();
  const apiKey = String(env.HERMES_API_KEY || "");
  if (!rawBase || !apiKey) {
    return {
      configured: false,
      missing: [
        ...(!rawBase ? ["HERMES_SERVICE_URL"] : []),
        ...(!apiKey ? ["HERMES_API_KEY"] : [])
      ]
    };
  }
  let parsed;
  try { parsed = new URL(rawBase); }
  catch { return { configured: false, missing: ["HERMES_SERVICE_URL_INVALID"] }; }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    return { configured: false, missing: ["HERMES_SERVICE_URL_INVALID"] };
  }
  return { configured: true, base: parsed.toString().replace(/\/$/, ""), apiKey };
}

function state(env = process.env) {
  const config = configuration(env);
  return {
    configured: config.configured,
    ...(config.missing?.length ? { required: config.missing } : {}),
    mode: "railway-private-http",
    operations: ["health", "capabilities", "submit_run", "get_run", "stop_run", "approve_run"],
    approvalRequiredOperations: ["submit_run", "stop_run", "approve_run"]
  };
}

async function request(path, options = {}, env = process.env, fetchFn = globalThis.fetch) {
  const config = configuration(env);
  if (!config.configured) {
    return { ok: false, status: 0, error: "hermes_adapter_not_configured", missingConfiguration: config.missing };
  }
  const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS, 60000));
  const headers = {
    accept: "application/json",
    authorization: "Bearer " + config.apiKey,
    ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
    ...(options.headers || {})
  };
  try {
    const response = await fetchFn(config.base + path, {
      method: options.method || "GET",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
      return { ok: false, status: response.status, error: "hermes_response_too_large" };
    }
    let result = {};
    if (text) {
      try { result = JSON.parse(text); }
      catch { result = { raw: text.slice(0, 8000) }; }
    }
    return {
      ok: response.ok,
      status: response.status,
      result,
      ...(!response.ok ? { error: result?.error?.code || result?.error || "hermes_http_error" } : {})
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "hermes_request_timeout"
        : "hermes_connection_failed"
    };
  }
}

function validateRunId(value) {
  const runId = String(value || "");
  return RUN_ID_PATTERN.test(runId) ? runId : null;
}

async function health(options = {}) {
  const config = configuration(options.env || process.env);
  if (!config.configured) return { ok: false, status: "not_configured", missingConfiguration: config.missing };
  const response = await request("/health", { timeoutMs: 5000 }, options.env || process.env, options.fetchFn);
  const healthy = response.ok && response.result?.status === "ok";
  return {
    ok: healthy,
    status: healthy ? "healthy" : response.status === 0 ? "offline" : "degraded",
    httpStatus: response.status,
    mode: "railway-private-http",
    ...(healthy ? {} : { error: response.error || "hermes_health_check_failed" })
  };
}

async function execute({ operation, input = {}, requestId, env = process.env, fetchFn = globalThis.fetch }) {
  const config = configuration(env);
  if (!config.configured) {
    return { ok: false, error: "adapter_not_configured", required: config.missing };
  }

  let path;
  let method = "GET";
  let body;
  let idempotencyKey;

  if (operation === "capabilities") {
    path = "/v1/capabilities";
  } else if (operation === "submit_run") {
    const prompt = String(input.input || "").trim();
    if (!prompt) return { ok: false, error: "hermes_input_required" };
    body = { input: prompt };
    for (const key of ["session_id", "instructions", "previous_response_id"]) {
      if (input[key] !== undefined) body[key] = input[key];
    }
    if (input.idempotency_key !== undefined) {
      idempotencyKey = String(input.idempotency_key);
      if (!/^[\x21-\x7E]{1,255}$/.test(idempotencyKey)) return { ok: false, error: "invalid_idempotency_key" };
    } else {
      idempotencyKey = String(requestId || "");
    }
    if (!idempotencyKey) return { ok: false, error: "idempotency_key_required" };
    method = "POST";
    path = "/v1/runs";
  } else if (["get_run", "stop_run", "approve_run"].includes(operation)) {
    const runId = validateRunId(input.run_id);
    if (!runId) return { ok: false, error: "valid_run_id_required" };
    path = "/v1/runs/" + encodeURIComponent(runId);
    if (operation === "stop_run") {
      method = "POST";
      path += "/stop";
      body = {};
    } else if (operation === "approve_run") {
      const requestIdValue = String(input.request_id || "");
      const choice = String(input.choice || "");
      const generation = input.execution_generation;
      if (!requestIdValue || !Number.isInteger(generation) || generation < 0 || !["once", "always", "deny"].includes(choice)) {
        return { ok: false, error: "valid_run_approval_required" };
      }
      method = "POST";
      path += "/approval";
      body = { request_id: requestIdValue, execution_generation: generation, choice };
    }
  } else {
    return { ok: false, error: "operation_not_supported", operation };
  }

  const response = await request(path, { method, body, idempotencyKey }, env, fetchFn);
  const sourcePath = path.split("/").slice(0, 4).join("/");
  return {
    ok: response.ok,
    id: "hermes-agent",
    operation,
    status: response.status,
    ...(response.result !== undefined ? { result: response.result } : {}),
    ...(response.error ? { error: response.error } : {}),
    ...(response.ok ? {
      evidence: {
        source: config.base + sourcePath,
        provider: "NousResearch Hermes Agent",
        retrievedAt: new Date().toISOString(),
        requestId,
        transport: "railway-private-http"
      }
    } : {})
  };
}

module.exports = { configuration, state, health, execute, validateRunId, request };
