#!/usr/bin/env node
// Independent security contract test. This test must remain unchanged unless the owner approves edits.
// Contract: a risk-sensitive operation is blocked without approval, and approval is bound to the exact input.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mindcloud-approval-contract-"));
const executionToken = "test-execution-token";
const approvalToken = "test-approval-token";
let app;
let mock;
let stderr = "";
let mockCalls = [];

async function freePort() {
  const srv = net.createServer();
  await new Promise(resolve => srv.listen(0, "127.0.0.1", resolve));
  const port = srv.address().port;
  await new Promise(resolve => srv.close(resolve));
  return port;
}
async function request(base, route, body, token) {
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const response = await fetch(base + route, {
    method: "POST", headers, body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
async function waitForHealth(base) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    try { if ((await fetch(base + "/health")).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("server_did_not_become_healthy: " + stderr);
}

(async () => {
  const port = await freePort();
  const mockPort = await freePort();
  const base = "http://127.0.0.1:" + port;

  mock = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      mockCalls.push({ url: req.url, body: JSON.parse(raw || "{}") });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, executed: true }));
    });
  });
  await new Promise(resolve => mock.listen(mockPort, "127.0.0.1", resolve));

  app = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      MINDCLOUD_TOOL_EXECUTION_TOKEN: executionToken,
      MINDCLOUD_APPROVAL_TOKEN: approvalToken,
      MINDCLOUD_MODEL_VERSION_STORE: path.join(temp, "versions.json"),
      MINDCLOUD_TASK_EVENT_STORE: path.join(temp, "events.json"),
      ADAPTER_ANTHROPIC_CYBERSECURITY_SKILLS_URL: "http://127.0.0.1:" + mockPort,
      COGNEE_SERVICE_URL: "",
      BROWSER_USE_SERVICE_URL: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  app.stderr.on("data", chunk => { stderr += chunk; });

  try {
    await waitForHealth(base);
    const originalInput = { target: "https://scope-a.example", intent: "assess" };
    const changedInput = { target: "https://scope-b.example", intent: "assess" };

    const noApproval = await request(base, "/api/adapters/execute", {
      id: "anthropic-cybersecurity-skills", operation: "assess", input: originalInput
    }, executionToken);
    assert.equal(noApproval.body.error, "human_approval_required",
      "RISK GATE FAILURE: sensitive action was not blocked without approval");
    assert.equal(mockCalls.length, 0, "RISK GATE FAILURE: upstream executed without approval");

    const requested = await request(base, "/api/approvals/request", {
      id: "anthropic-cybersecurity-skills", operation: "assess", input: originalInput
    }, executionToken);
    assert.equal(requested.status, 201, "approval request must be created");
    const approvalId = requested.body.request.id;
    const decision = await request(base, "/api/approvals/" + approvalId + "/decision", {
      decision: "approved", reason: "Independent contract test"
    }, approvalToken);
    assert.equal(decision.body.request.status, "approved", "approval must be recorded");

    const mismatched = await request(base, "/api/adapters/execute", {
      id: "anthropic-cybersecurity-skills",
      operation: "assess",
      input: changedInput,
      approvalId
    }, executionToken);

    assert.equal(mismatched.body.error, "human_approval_required",
      "APPROVAL SCOPE FAILURE: approval for one input authorized a different input");
    assert.equal(mockCalls.length, 0,
      "APPROVAL SCOPE FAILURE: changed input reached the external execution adapter");

    console.log(JSON.stringify({
      grader: "approval-gate",
      result: "PASS",
      checks: ["blocked-without-approval", "approval-bound-to-exact-input", "no-upstream-call-on-block"]
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      grader: "approval-gate",
      result: "FAIL",
      reason: error.message,
      upstreamCalls: mockCalls.length,
      observedUpstreamCalls: mockCalls
    }, null, 2));
    process.exitCode = 1;
  } finally {
    app?.kill("SIGKILL");
    fs.rmSync(temp, { recursive: true, force: true });
    mock?.closeAllConnections?.();
    if (mock) await new Promise(resolve => mock.close(resolve));
  }
})();
