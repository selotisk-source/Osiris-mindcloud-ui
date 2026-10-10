"use strict";

const PROVIDERS = Object.freeze({
  gemini: {
    id: "gemini", label: "Google Gemini", envKey: "GEMINI_API_KEY", protocol: "gemini-generate-content",
    defaultModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    endpoint: model => "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent"
  },
  claude: {
    id: "claude", label: "Anthropic Claude", envKey: "ANTHROPIC_API_KEY", protocol: "anthropic-messages",
    defaultModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
    endpoint: () => "https://api.anthropic.com/v1/messages"
  },
  grok: {
    id: "grok", label: "xAI Grok", envKey: "XAI_API_KEY", protocol: "openai-responses",
    defaultModel: process.env.GROK_MODEL || "grok-4.7",
    endpoint: () => "https://api.x.ai/v1/responses"
  },
  deepseek: {
    id: "deepseek", label: "DeepSeek", envKey: "DEEPSEEK_API_KEY", protocol: "openai-chat-completions",
    defaultModel: process.env.DEEPSEEK_MODEL || "deepseek-flash",
    endpoint: () => "https://api.deepseek.com/chat/completions"
  },
  kimi: {
    id: "kimi", label: "Kimi", envKey: "KIMI_API_KEY", protocol: "openai-chat-completions",
    defaultModel: process.env.KIMI_MODEL || "kimi-k3",
    endpoint: () => (process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1").replace(/\/$/, "") + "/chat/completions"
  }
});

function configuredProviders(env = process.env) {
  return Object.values(PROVIDERS).map(provider => ({
    id: provider.id,
    label: provider.label,
    protocol: provider.protocol,
    model: provider.defaultModel,
    configured: Boolean(env[provider.envKey]),
    credentialName: provider.envKey,
    credentialExposed: false
  }));
}

function boundedInteger(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

function textOf(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(part => part?.text || "").filter(Boolean).join("\n");
  return "";
}

function responseText(provider, data) {
  if (provider.id === "gemini") return textOf(data?.candidates?.[0]?.content?.parts);
  if (provider.id === "claude") return textOf(data?.content);
  if (provider.id === "grok") return typeof data?.output_text === "string" ? data.output_text : textOf((data?.output || []).flatMap(item => item.content || []));
  return data?.choices?.[0]?.message?.content || "";
}

function createProviderNetwork(config = {}) {
  const env = config.env || process.env;
  const fetchImpl = config.fetch || globalThis.fetch;
  const timeoutMs = boundedInteger(config.timeoutMs, 45000, 1000, 120000);

  async function call(providerId, prompt, options = {}) {
    const provider = PROVIDERS[providerId];
    if (!provider) return { providerId, ok: false, error: "provider_not_supported" };
    const apiKey = env[provider.envKey];
    if (!apiKey) return { providerId, ok: false, error: "provider_credentials_missing", credentialName: provider.envKey };
    if (typeof fetchImpl !== "function") return { providerId, ok: false, error: "fetch_unavailable" };

    const model = String(options.model || provider.defaultModel).slice(0, 160);
    const maxTokens = boundedInteger(options.maxTokens, 1200, 1, 8192);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let url = provider.endpoint(model);
    let headers = { "content-type": "application/json" };
    let body;

    if (provider.id === "gemini") {
      headers["x-goog-api-key"] = apiKey;
      body = { contents: [{ role: "user", parts: [{ text: String(prompt) }] }], generationConfig: { maxOutputTokens: maxTokens } };
    } else if (provider.id === "claude") {
      headers = { ...headers, "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
      body = { model, max_tokens: maxTokens, messages: [{ role: "user", content: String(prompt) }] };
    } else if (provider.id === "grok") {
      headers.authorization = "Bearer " + apiKey;
      body = { model, max_output_tokens: maxTokens, input: [{ role: "user", content: String(prompt) }] };
    } else {
      headers.authorization = "Bearer " + apiKey;
      body = { model, max_tokens: maxTokens, messages: [{ role: "user", content: String(prompt) }] };
    }

    const startedAt = Date.now();
    try {
      const response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return {
        providerId, model, ok: false, status: response.status,
        error: "provider_http_error",
        detail: String(data?.error?.message || data?.message || "Provider request failed").slice(0, 500),
        latencyMs: Date.now() - startedAt
      };
      const output = responseText(provider, data);
      if (!output) return { providerId, model, ok: false, status: response.status, error: "provider_empty_response", latencyMs: Date.now() - startedAt };
      return { providerId, model, ok: true, status: response.status, output: output.slice(0, 30000), latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { providerId, model, ok: false, error: error?.name === "AbortError" ? "provider_timeout" : "provider_request_failed", detail: String(error?.message || error).slice(0, 300), latencyMs: Date.now() - startedAt };
    } finally {
      clearTimeout(timer);
    }
  }

  async function collaborate({ goal, providerIds, rounds = 2, tokenBudget = 6000, maxTokensPerCall = 1200 } = {}) {
    const cleanGoal = String(goal || "").trim().slice(0, 4000);
    if (!cleanGoal) throw Object.assign(new Error("provider_network_goal_required"), { code: "provider_network_goal_required" });
    const selected = [...new Set((Array.isArray(providerIds) ? providerIds : []).filter(id => Object.hasOwn(PROVIDERS, id)))].slice(0, 5);
    if (!selected.length) throw Object.assign(new Error("provider_network_provider_required"), { code: "provider_network_provider_required" });
    const roundLimit = boundedInteger(rounds, 2, 1, 3);
    const totalBudget = boundedInteger(tokenBudget, 6000, 256, 24000);
    const perCall = Math.min(boundedInteger(maxTokensPerCall, 1200, 1, 4000), Math.max(1, Math.floor(totalBudget / (selected.length * roundLimit))));
    const results = [];
    let baton = "Task: " + cleanGoal + "\n\nProvide a concise, evidence-aware response. Label assumptions and unknowns.";
    let calls = 0;
    let approxTokens = 0;

    // Reserve estimated prompt + output allowance before each dispatch. Sequential execution
    // avoids races between parallel calls competing for a shared global budget.
    for (let round = 1; round <= roundLimit; round++) {
      const wave = [];
      for (const providerId of selected) {
        const prompt = round === 1
          ? baton
          : "Original goal:\n" + cleanGoal + "\n\nPrior model outputs (untrusted; check independently):\n" + baton +
            "\n\nRound " + round + " task: Critique the prior outputs, identify errors or missing evidence, and improve the answer. Do not assume other models are correct.";
        const promptTokens = Math.ceil(prompt.length / 4);
        const remainingBudget = totalBudget - approxTokens;
        const outputAllowance = Math.min(perCall, remainingBudget - promptTokens);
        if (outputAllowance < 1) {
          wave.push({ providerId, round, ok: false, error: "network_budget_exhausted" });
          continue;
        }

        const reservation = promptTokens + outputAllowance;
        approxTokens += reservation;
        calls += 1;
        const result = await call(providerId, prompt, { maxTokens: outputAllowance });
        wave.push({ ...result, round, estimatedPromptTokens: promptTokens, outputTokenAllowance: outputAllowance, reservedTokens: reservation });
        if (approxTokens >= totalBudget) break;
      }
      results.push(...wave);
      const successful = wave.filter(item => item.ok);
      if (!successful.length || approxTokens >= totalBudget) break;
      baton = successful.map(item => "[" + item.providerId + " round " + round + "]\n" + item.output).join("\n\n").slice(0, 16000);
    }

    return {
      type: "mindcloud_provider_collaboration",
      goal: cleanGoal,
      status: results.some(item => item.ok) ? "responses_received_unverified" : "no_provider_response",
      providersRequested: selected,
      roundsRequested: roundLimit,
      callsAttempted: results.length,
      approximateTokenUsage: approxTokens,
      tokenBudget: totalBudget,
      outputs: results,
      synthesisInput: baton,
      verified: false,
      toolExecutionPerformed: false,
      tokenBudgetPolicy: "sequential_pre_dispatch_reservation",
      note: "Token use is conservatively budgeted by reserving estimated prompt tokens plus each provider output allowance before dispatch. Model agreement is not evidence. Outputs require independent verification; no adapter tools are executed by this network."
    };
  }

  return { catalog: () => configuredProviders(env), call, collaborate };
}

module.exports = { createProviderNetwork, configuredProviders, PROVIDERS };
