"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildPersonalPowerGraph } = require("../mindcloud/neutral-network-personal-power");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "personal-power.html"), "utf8");
const backend = fs.readFileSync(path.join(root, "server.js"), "utf8");
const frontend = fs.readFileSync(path.join(root, "frontend-server.js"), "utf8");
const workspace = fs.readFileSync(path.join(root, "index.html"), "utf8");
const graph = buildPersonalPowerGraph({ capturedAt: "2026-10-15T00:00:00.000Z" });

const checks = [
  ["graph adapter returns the Neutral Network schema", graph.schema === "mindcloud.neutral-network.graph.v1"],
  ["graph retains source provenance", graph.nodes.every(n => n.provenance?.sourceId === graph.source.id)],
  ["graph relations reference real nodes", graph.edges.every(e => graph.nodes.some(n => n.id === e.from) && graph.nodes.some(n => n.id === e.to))],
  ["unverified transcription is never promoted", graph.nodes.every(n => n.verified === false) && graph.status === "ingestion_preview"],
  ["MindCore exposes the Personal Power graph endpoint", backend.includes('pathname==="/api/neutral-network/personal-power"') && backend.includes('require("./mindcloud/neutral-network-personal-power")')],
  ["personal graph endpoint requires authorization unless explicitly made public", backend.includes('MINDCLOUD_PERSONAL_POWER_PUBLIC !== "true" && !isExecutionAuthorized(req)')],
  ["frontend serves the dedicated Personal Power page", frontend.includes('"/personal-power": ["personal-power.html", "text/html; charset=utf-8"]')],
  ["workspace navigation links to Personal Power", workspace.includes('href="/personal-power">Personal Power / Neutral Network</a>')],
  ["visualization fetches the actual MindCore graph endpoint", page.includes("fetch('/api/neutral-network/personal-power'")],
  ["visualization reports preview and validation boundaries", page.includes("TRANSCRIPTION PREVIEW · NOT VALIDATED") && page.includes("Evidence persistence") && page.includes("Approval required")],
  ["visualization explains authorization failure without exposing private data", page.includes("AUTHORIZATION REQUIRED") && page.includes("Private graph data is not exposed anonymously")],
  ["visualization includes an interactive node inspector", page.includes("function selectNode(node)") && page.includes('id="detail"')],
  ["visualization includes the integration pipeline", page.includes("Neutral Network") && page.includes("Metanoia") && page.includes("MindCore Integration Pipeline")]
];

for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) process.exitCode = 1;
else console.log("Neutral Network Personal Power integration checks passed.");
