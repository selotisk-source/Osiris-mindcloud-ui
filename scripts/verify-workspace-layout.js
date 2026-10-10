#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /setWorkspaceLayout\(2\);\s*\/\/ default two-station workspace/,
  "workspace must initialize to two stations");
assert.match(html, /const show=n===2\?\(id===1\|\|id===3\):\(id<=n\)/,
  "two-station mode must show the coordinator and research/evidence station");
assert.match(html, /ws\.dataset\.layoutMode=String\(n\)/,
  "workspace layout mode must be reflected in the DOM for responsive CSS");
console.log("workspace-layout: verified two-station default and station selection");
