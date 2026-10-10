#!/usr/bin/env node
import { spawn } from "node:child_process";

// Pin the known-good MCP server version: `latest` can drift and trigger expensive
// native dependency rebuilds in CI before the protocol handshake even starts.
const timeoutMs = Number(process.env.RUFLO_MCP_TIMEOUT_MS ?? 180000);
const child = spawn("npx", ["-y", "ruflo@3.0.0", "mcp", "start"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, NO_COLOR: "1" },
});

let buffer = "";
let stderr = "";
const pending = new Map();

function send(id, method, params = {}) {
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function consume(chunk) {
  buffer += chunk.toString();
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line.startsWith("{")) continue;
    try {
      const message = JSON.parse(line);
      if (message.id == null) continue;
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    } catch {
      // Ignore non-JSON diagnostic output; MCP responses still must be valid JSON-RPC.
    }
  }
}

child.stdout.on("data", consume);
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
child.on("error", (error) => {
  console.error(`RuFlo process failed to start: ${error.message}`);
  process.exitCode = 1;
});

const timer = setTimeout(() => {
  console.error(`RuFlo MCP smoke test timed out after ${timeoutMs}ms.`);
  if (stderr.trim()) console.error(stderr.trim().slice(-6000));
  child.kill("SIGTERM");
  process.exit(2);
}, timeoutMs);

try {
  const initialized = await send(1, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "mindcloud-ruflo-smoke-test", version: "1.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
  const tools = await send(2, "tools/list", {});
  const toolCount = Array.isArray(tools?.tools) ? tools.tools.length : 0;
  if (!initialized?.serverInfo || toolCount < 1) {
    throw new Error(`MCP handshake succeeded but tool discovery was invalid (tools=${toolCount}).`);
  }
  console.log(JSON.stringify({ ok: true, pinnedVersion: "3.0.0", server: initialized.serverInfo, protocolVersion: initialized.protocolVersion, toolCount }));
  clearTimeout(timer);
  child.kill("SIGTERM");
} catch (error) {
  clearTimeout(timer);
  console.error(String(error));
  if (stderr.trim()) console.error(stderr.trim().slice(-6000));
  child.kill("SIGTERM");
  process.exit(1);
}
