#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { validateCapabilityRegistry } = require("../mindcloud/rd-run-store");
const registry = JSON.parse(fs.readFileSync("integrations/agent-tools.json", "utf8"));
const result = validateCapabilityRegistry(registry);
assert.equal(result.ok, true, result.errors.join("; "));
const cookie = registry.tools.find(tool => tool.id === "cookies-viewer");
assert.ok(cookie, "cookies-viewer registry entry must remain explicit");
assert.equal(cookie.status, "registered-only", "cookie access is not implemented in the extension");
const duplicate = validateCapabilityRegistry({ tools: [registry.tools[0], registry.tools[0]] });
assert.equal(duplicate.ok, false);
const badStatus = validateCapabilityRegistry({ tools: [{ id:"x", source:"x", layer:"x", operations:["run"], status:"magic" }] });
assert.equal(badStatus.ok, false);
const falseReady = validateCapabilityRegistry({ tools: [{ id:"cookies-viewer", source:"x", layer:"x", operations:["list"], status:"adapter-ready" }] });
assert.equal(falseReady.ok, false);
console.log(JSON.stringify({ status:"verified", capabilities:result.count, checks:["unique-ids","allowed-statuses","required-metadata","cookie-viewer-not-falsely-adapter-ready","invalid-status-rejected"] }, null, 2));
