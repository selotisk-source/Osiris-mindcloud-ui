#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const packageJson = require("../package.json");

const commands = String(packageJson.scripts.verify || "")
  .split("&&")
  .map(command => command.trim())
  .filter(Boolean);

if (commands.length === 0) {
  console.error("verify_script_missing");
  process.exit(1);
}

for (const command of commands) {
  const args = command.split(/\s+/);
  const executable = args.shift();
  if (executable !== "node") {
    console.error("unsupported_verify_command:" + executable);
    process.exit(1);
  }
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("MindCloud verification suite passed.");
