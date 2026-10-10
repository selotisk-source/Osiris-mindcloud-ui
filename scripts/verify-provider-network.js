"use strict";
const assert = require("node:assert/strict");
const { createProviderNetwork } = require("../mindcore/provider-network");

const env = {
  GEMINI_API_KEY: "gemini-test-secret",
  ANTHROPIC_API_KEY: "claude-test-secret",
  XAI_API_KEY: "grok-test-secret",
  DEEPSEEK_API_KEY: "deepseek-test-secret",
  KIMI_API_KEY: "kimi-test-secret"
};
const calls = [];
const fetch = async (url, options) => {
  calls.push({ url, options });
  const body = JSON.parse(options.body);
  let data;
  if (url.includes("generativelanguage.googleapis.com")) data = { candidates: [{ content: { parts: [{ text: "Gemini result" }] } }] };
  else if (url.includes("api.anthropic.com")) data = { content: [{ type: "text", text: "Claude result" }] };
  else if (url.includes("api.x.ai")) data = { output_text: "Grok result" };
  else data = { choices: [{ message: { content: url.includes("moonshot") ? "Kimi result" : "DeepSeek result" } }] };
  return { ok: true, status: 200, json: async () => data };
};

(async () => {
  const network = createProviderNetwork({ env, fetch, timeoutMs: 2000 });
  assert.deepEqual(network.catalog().map(p => p.configured), [true, true, true, true, true]);
  const results = await Promise.all(["gemini", "claude", "grok", "deepseek", "kimi"].map(id => network.call(id, "test prompt", { maxTokens: 128 })));
  assert.ok(results.every(result => result.ok));
  assert.deepEqual(results.map(result => result.output), ["Gemini result", "Claude result", "Grok result", "DeepSeek result", "Kimi result"]);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => !call.url.includes("secret") && !/[?&]key=/.test(call.url)), "API secrets must not be sent in URLs");
  const geminiCall = calls.find(call => call.url.includes("generativelanguage.googleapis.com"));
  assert.equal(geminiCall.options.headers["x-goog-api-key"], env.GEMINI_API_KEY, "Gemini credentials must use the API-key header");
  assert.ok(calls.every(call => call.options.signal instanceof AbortSignal), "provider calls must have timeout cancellation");
  const missing = createProviderNetwork({ env: {}, fetch });
  assert.equal((await missing.call("claude", "test")).error, "provider_credentials_missing");
  const collaboration = await network.collaborate({ goal: "Compare provider responses", providerIds: ["gemini", "claude", "grok", "deepseek", "kimi"], rounds: 2, tokenBudget: 2400, maxTokensPerCall: 128 });
  assert.equal(collaboration.type, "mindcloud_provider_collaboration");
  assert.equal(collaboration.status, "responses_received_unverified");
  assert.equal(collaboration.verified, false);
  assert.equal(collaboration.toolExecutionPerformed, false);
  assert.ok(collaboration.callsAttempted <= 10);\n  assert.ok(collaboration.approximateTokenUsage <= collaboration.tokenBudget, "global reserved token usage must never exceed the budget");\n  assert.equal(collaboration.tokenBudgetPolicy, "sequential_pre_dispatch_reservation");\n  assert.ok(collaboration.outputs.filter(item => item.ok).every(item => item.reservedTokens === item.estimatedPromptTokens + item.outputTokenAllowance));
  const noProvider = await missing.collaborate({ goal: "Test no credentials", providerIds: ["claude"] });
  assert.equal(noProvider.status, "no_provider_response");
  console.log("provider-network: verified provider normalization, credential isolation, bounded multi-round handoff, and unverified-output safety gate");
})().catch(error => { console.error(error); process.exitCode = 1; });
