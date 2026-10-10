#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /setWorkspaceLayout\(2\);/, "workspace must initialize in two-station mode");
assert.match(html, /const show=n===2\?\(id===1\|\|id===3\):\(id<=n\)/, "two-station mode must show coordinator and research/evidence station");
assert.match(html, /ws\.dataset\.layoutMode=String\(n\)/, "layout mode must be reflected in the DOM");
assert.match(html, /data-layout="4"/, "four-station layout must remain available");
console.log("workspace-layout: verified two-station default, station selection, layout state, and four-station option");
