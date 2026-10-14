#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /setWorkspaceLayout\(2\);/, "workspace must initialize in two-station mode");
assert.match(html, /class="btn active" data-layout="2"/, "two-station control must be active by default");
assert.match(html, /two-station workspace/, "workspace status must describe the default layout");
assert.match(html, /const show=n===2\?\(id===1\|\|id===4\):\(id<=n\)/, "layout mode must select the expected station set");
assert.match(html, /ws\.dataset\.layoutMode=String\(n\)/, "layout mode must be reflected in the DOM");
assert.match(html, /ws\.style\.gridTemplateRows=\(n===2\|\|n===3\)\?\x27minmax\(0,1fr\)\x27:\x27repeat\(2,minmax\(0,1fr\)\)\x27/, "four-station mode must use two equal grid rows");
assert.match(html, /\.workspace\[data-layout-mode="4"\] \[data-station="1"\]\{grid-column:1;grid-row:1\}/, "MindCore must occupy top-left");
assert.match(html, /\.workspace\[data-layout-mode="4"\] \[data-station="2"\]\{grid-column:2;grid-row:1\}/, "GEO / Heritage must occupy top-right");
assert.match(html, /\.workspace\[data-layout-mode="4"\] \[data-station="3"\]\{grid-column:1;grid-row:2\}/, "Sensor Fabric must occupy bottom-left");
assert.match(html, /\.workspace\[data-layout-mode="4"\] \[data-station="4"\]\{grid-column:2;grid-row:2\}/, "God’s Eye View must occupy bottom-right");
assert.match(html, /data-layout="4"/, "four-station layout must remain available");
assert.match(html, /if\(name==='Heritage Map'\)\{\s*closeAll\(\);\s*const layout4=document\.querySelector\('\[data-layout="4"\]'\)/, "Heritage Map must preserve the four-station workspace");
assert.match(html, /const geo=document\.querySelector\('\[data-station="2"\]'\)/, "Heritage Map must target the visible GEO / Heritage station");
assert.doesNotMatch(html, /if\(name==='Heritage Map'\)\{closeAll\(\);const layout2=/, "Heritage Map must not switch to a layout that hides its target station");
console.log("workspace-layout: verified two-station MindCore + OSIRIS default, selectable 2x2 layout, and visible Heritage Map routing");
