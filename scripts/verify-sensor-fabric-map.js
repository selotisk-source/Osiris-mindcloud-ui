const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /data-module="Sensor Fabric"/, "Sensor Fabric navigation entry must exist");
assert.match(html, /if\(name==='Sensor Fabric'\)\{\s*openModule\(name\);\s*return;/, "Sensor Fabric navigation must open its module panel");
assert.match(html, /\.sensor-fabric-map\{height:min\(68vh,680px\)/, "map container must have a visible height");
assert.match(html, /id="sensorFabricMap" class="sensor-fabric-map"/, "map container must be rendered");
assert.match(html, /window\.L\.map\('sensorFabricMap'/, "Leaflet must initialize on the Sensor Fabric map");
assert.match(html, /tile\.openstreetmap\.org/, "map must load attributed OpenStreetMap tiles");
assert.match(html, /sensorMapVarna[\s\S]*sensorMapSofia[\s\S]*sensorMapWorld/, "Varna, Sofia and world navigation controls must exist");
assert.match(html, /fetch\('\/api\/cctv',\{cache:'no-store'\}\)/, "map panel must read current CCTV connector status");
assert.match(html, /Camera markers are intentionally omitted until trusted coordinates are supplied/, "unverified sensor coordinates must not be fabricated");
const sensorPanel = html.split("else if(name==='Sensor Fabric'){")[1]?.split("\nelse if(name==='Heritage Map')")[0] || "";
assert.ok(sensorPanel, "Sensor Fabric panel implementation must be discoverable");
assert.doesNotMatch(sensorPanel, /L\.(?:marker|circleMarker)\(/, "Sensor Fabric must not plot unverified sensor markers");
console.log("sensor-fabric-map: PASS — reachable navigation, visible Leaflet map, OSM tiles, Varna/Sofia/world controls, live CCTV status, no fabricated markers");
