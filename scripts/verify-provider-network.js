"use strict";
const assert = require("node:assert/strict");
const { createProviderNetwork } = require("../mindcore/provider-network");

const env = {
  GEMINI_API_KEY: "gemini-test-secret",
  ANTHROPIC_API_KEY: "claude-test-secret",
  XAI_API_KEY: "grok-test-secret",
  DEEPSEEK_API_KEY: "deepseek-test-secret",
  KIMI_API_KEY: "kimi-test-secret",
  PHI4_HERETIC_BASE_URL: "http://phi4-test.local/v1"
};
const calls = [];
const fetch = async (url, options) => {
  calls.push({ url, options });
  let data;
  if (url.includes("generativelanguage.googleapis.com")) data = { candidates: [{ content: { parts: [{ text: "Gemini result" }] } }] };
  else if (url.includes("api.anthropic.com")) data = { content: [{ type: "text", text: "Claude result" }] };
  else if (url.includes("api.x.ai")) data = { output_text: "Grok result" };
  else if (url.includes("phi4-test.local")) data = { choices: [{ message: { content: "Phi-4 Heretic result" } }] };
  else data = { choices: [{ message: { content: url.includes("moonshot") ? "Kimi result" : "DeepSeek result" } }] };
  return { ok: true, status: 200, json: async () => data };
};

(async () => {
  const network = createProviderNetwork({ env, fetch, timeoutMs: 2000 });
  assert.deepEqual(network.catalog().map(p => p.configured), [true, true, true, true, true, true]);
  const results = await Promise.all(["gemini", "claude", "grok", "deepseek", "kimi"].map(id => network.call(id, "test prompt", { maxTokens: 128 })));
  assert.ok(results.every(result => result.ok));
  assert.deepEqual(results.map(result => result.output), ["Gemini result", "Claude result", "Grok result", "DeepSeek result", "Kimi result"]);
  const phi = await network.call("phi4heretic", "Run a reasoning check", { maxTokens: 128 });
  assert.equal(phi.ok, true);
  assert.equal(phi.output, "Phi-4 Heretic result");
  const phiCall = calls.find(call => call.url === "http://phi4-test.local/v1/chat/completions");
  assert.ok(phiCall, "Phi-4 Heretic must use the configured OpenAI-compatible endpoint");
  assert.equal(JSON.parse(phiCall.options.body).model, "p-e-w/phi-4-heretic");
  assert.equal(phiCall.options.headers.authorization, undefined, "self-hosted endpoint must work without a key");
  assert.equal(calls.length, 6);
  assert.ok(calls.every(call => !call.url.includes("secret") && !/[?&]key=/.test(call.url)), "API secrets must not be sent in URLs");
  const geminiCall = calls.find(call => call.url.includes("generativelanguage.googleapis.com"));
  assert.equal(geminiCall.options.headers["x-goog-api-key"], env.GEMINI_API_KEY, "Gemini credentials must use the API-key header");
  assert.ok(calls.every(call => call.options.signal instanceof AbortSignal), "provider calls must have timeout cancellation");
  const missing = createProviderNetwork({ env: {}, fetch });
  assert.equal((await missing.call("claude", "test")).error, "provider_credentials_missing");
  assert.equal((await missing.call("phi4heretic", "test")).error, "provider_endpoint_missing");
  const collaboration = await network.collaborate({ goal: "Compare provider responses", providerIds: ["gemini", "claude", "grok", "deepseek", "kimi"], rounds: 2, tokenBudget: 2400, maxTokensPerCall: 128 });
  assert.equal(collaboration.type, "mindcloud_provider_collaboration");
  assert.equal(collaboration.status, "responses_received_unverified");
  assert.equal(collaboration.verified, false);
  assert.equal(collaboration.toolExecutionPerformed, false);
  assert.ok(collaboration.callsAttempted <= 10);
  assert.ok(collaboration.approximateTokenUsage <= collaboration.tokenBudget, "global reserved token usage must never exceed the budget");
  assert.equal(collaboration.tokenBudgetPolicy, "sequential_pre_dispatch_reservation");
  assert.ok(collaboration.outputs.filter(item => item.ok).every(item => item.reservedTokens === item.estimatedPromptTokens + item.outputTokenAllowance));
  const tightBudget = await network.collaborate({ goal: "Budget regression", providerIds: ["gemini", "claude", "grok", "deepseek", "kimi"], rounds: 1, tokenBudget: 256, maxTokensPerCall: 128 });
  assert.ok(tightBudget.approximateTokenUsage <= 256, "five-provider fan-out must respect a tight global budget");
  assert.ok(tightBudget.outputs.filter(item => item.ok).every(item => item.reservedTokens <= 256), "every dispatched call must have a bounded reservation");
  const noProvider = await missing.collaborate({ goal: "Test no credentials", providerIds: ["claude"] });
  assert.equal(noProvider.status, "no_provider_response");
  console.log("provider-network: verified Phi-4 Heretic OpenAI-compatible routing, endpoint/key isolation, provider normalization, bounded collaboration, and unverified-output safety gate");
})().catch(error => { console.error(error); process.exitCode = 1; });
