#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /setWorkspaceLayout\(4\);/, "workspace must initialize in four-station mode");
assert.match(html, /const show=n===2\?\(id===1\|\|id===2\):\(id<=n\)/, "layout mode must select the expected station set");
assert.match(html, /ws\.dataset\.layoutMode=String\(n\)/, "layout mode must be reflected in the DOM");
assert.match(html, /\.workspace\[data-layout-mode="2"\]\{grid-template-rows:minmax\(0,1fr\)\}/, "two-station desktop layout must use the full available workspace height");
assert.match(html, /data-layout="4"/, "four-station layout must remain available");
console.log("workspace-layout: verified four-station default, dynamic station selection, and 2x2 grid rows");
