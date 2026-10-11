#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("osiris.html", "utf8");
assert.match(html, /\["ok","healthy"\]\.includes\(String\(h\.status\|\|""\)\.toLowerCase\(\)\)/,
  "OSIRIS console must treat both documented healthy status variants as healthy");
assert.match(html, /health\.ok&&\["ok","healthy"\]\.includes/,
  "OSIRIS console must also require a successful HTTP response");
console.log("osiris-console-health: verified healthy/ok status compatibility and HTTP success gate");
