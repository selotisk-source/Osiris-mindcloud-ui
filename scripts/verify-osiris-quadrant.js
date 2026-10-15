#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /<section class="station osiris-station" data-station="4">/, "OSIRIS must occupy station four");
assert.doesNotMatch(html, /<iframe id="osirisFrame"/, "do not embed OSIRIS while its source policy restricts cross-origin framing");
assert.match(html, /id="osirisLaunchTitle"/, "station four must show the OSIRIS launch panel");
assert.match(html, /id="osirisEmbedStatus"[^>]*>OSIRIS currently restricts cross-origin framing/, "the panel must explain standalone access");
assert.match(html, /id="osirisOpenStandalone" href="https:\/\/osirisai\.live\/" target="_blank" rel="noopener noreferrer"/, "new-tab launch must use the official URL and safe opener attributes");
assert.match(html, /id="osirisOpenHere" href="https:\/\/osirisai\.live\/" target="_self"/, "same-tab launch must remain available");
assert.doesNotMatch(html, /clipboard-(?:read|write)/, "no external-page clipboard permission may be granted");
assert.match(html, /data-station="1"/, "MindCore station must remain");
assert.match(html, /data-station="2"/, "GEO station must remain");
assert.match(html, /data-station="3"/, "Sensor Fabric station must remain");
assert.match(html, /const show=n===2\?\(id===1\|\|id===4\):\(id<=n\)/, "two-station mode must show MindCore and OSIRIS");
assert.match(html, /setWorkspaceLayout\(2\)/, "two-station workspace must be the default");
assert.match(html, /class="btn active" data-layout="2"/, "two-station control must be active by default");
assert.match(html, /two-station workspace/, "workspace status must describe the default layout");
assert.match(html, /data-layout="4"/, "four-station workspace must remain selectable");

console.log("osiris-quadrant: verified MindCore + OSIRIS default, secure standalone launch, and four-station fallback");
