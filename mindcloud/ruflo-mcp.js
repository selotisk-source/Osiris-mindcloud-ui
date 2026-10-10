"use strict";

const { spawn } = require("node:child_process");

const DEFAULT_TIMEOUT_MS = 120000;
const MAX_LINE_BYTES = 2 * 1024 * 1024;
const MAX_TOOLS = 500;

function safeEnv(source = process.env) {
  const env = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "CI", "NO_COLOR", "NPM_CONFIG_CACHE"]) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  env.NO_COLOR = "1";
  return env;
}

function summarizeTools(value) {
  const tools = Array.isArray(value?.tools) ? value.tools : [];
  if (tools.length < 1) throw new Error("ruflo_mcp_tool_discovery_empty");
  return tools.slice(0, MAX_TOOLS).map((tool) => ({
    name: String(tool?.name || "unknown").slice(0, 200),
    description: String(tool?.description || "").slice(0, 500),
    inputKeys: Object.keys(tool?.inputSchema?.properties || {}).slice(0, 100)
  }));
}

async function discoverTools(options = {}) {
  const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS));
  const spawnFn = options.spawnFn || spawn;
  const child = spawnFn("npx", ["--yes", "ruflo@3.56.3", "mcp", "start"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: safeEnv(options.env || process.env)
  });

  let buffer = "";
  let stderr = "";
  let finished = false;
  const pending = new Map();
  let nextId = 1;

  const failPending = (error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };

  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    child.kill("SIGTERM");
    failPending(new Error("ruflo_mcp_process_closed"));
  };

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n", (error) => {
        if (!error) return;
        pending.delete(id);
        reject(error);
      });
    });
  }

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    if (Buffer.byteLength(buffer) > MAX_LINE_BYTES) {
      failPending(new Error("ruflo_mcp_response_too_large"));
      cleanup();
      return;
    }
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("{")) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id == null) continue;
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error("ruflo_mcp_rpc_error:" + JSON.stringify(message.error).slice(0, 1000)));
      else waiter.resolve(message.result);
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-8000);
  });
  child.on("error", (error) => {
    failPending(error);
    cleanup();
  });
  child.on("exit", (code, signal) => {
    if (!finished) {
      failPending(new Error("ruflo_mcp_process_exited:" + String(code) + ":" + String(signal) + (stderr ? ":" + stderr.slice(-1000) : "")));
      cleanup();
    }
  });

  const timer = setTimeout(() => {
    failPending(new Error("ruflo_mcp_timeout"));
    cleanup();
  }, timeoutMs);

  try {
    const initialized = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mindcloud-readonly-adapter", version: "1.0.0" }
    });
    if (!initialized?.serverInfo) throw new Error("ruflo_mcp_initialize_invalid");
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {}
    }) + "\n");
    const listed = await send("tools/list", {});
    const tools = summarizeTools(listed);
    return {
      ok: true,
      server: {
        name: String(initialized.serverInfo.name || "unknown").slice(0, 100),
        version: String(initialized.serverInfo.version || "unknown").slice(0, 100)
      },
      protocolVersion: initialized.protocolVersion || null,
      toolCount: Array.isArray(listed?.tools) ? listed.tools.length : tools.length,
      tools,
      executionEnabled: false,
      note: "Read-only discovery only; MindCloud does not invoke discovered RuFlo tools."
    };
  } finally {
    cleanup();
  }
}

module.exports = { discoverTools, safeEnv, summarizeTools };
