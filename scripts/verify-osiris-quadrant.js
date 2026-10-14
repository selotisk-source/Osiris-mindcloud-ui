#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /<section class="station osiris-station" data-station="4">/, "OSIRIS must occupy station four in the 2×2 workspace");
assert.match(html, /<iframe id="osirisFrame"[^>]*src="https:\/\/osirisai\.live\/"[^>]*title="OSIRIS live intelligence platform"/, "station must load the existing official OSIRIS website");
assert.match(html, /id="osirisReload"/, "OSIRIS panel must expose an independent reload control");
assert.match(html, /getElementById\("osirisReload"\)\.addEventListener\("click"/, "reload control must be wired");
assert.match(html, /OPEN STANDALONE/, "standalone fallback must remain available if framing is blocked");
assert.match(html, /https:\/\/osirisai\.live\//, "official OSIRIS URL must be present");
assert.match(html, /osirisFrame\.addEventListener\("load"/, "embed load state must be reported");
assert.match(html, /data-station="1"/, "MindCore station must remain");
assert.match(html, /data-station="2"/, "GEO station must remain");
assert.match(html, /data-station="3"/, "Sensor Fabric station must remain");
assert.match(html, /const show=n===2\?\(id===1\|\|id===4\):\(id<=n\)/, "two-station mode must show MindCore and OSIRIS");
assert.match(html, /setWorkspaceLayout\(2\)/, "two-station workspace must be the default");
assert.match(html, /data-layout="4"/, "four-station 2×2 workspace must remain selectable");

console.log("osiris-quadrant: verified official-site iframe, independent reload, standalone fallback, and four-station layout");
