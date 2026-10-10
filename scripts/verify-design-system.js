#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("index.html", "utf8");
const style = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || "";
assert.match(style, /--mc-focus:/, "design tokens must define a focus color");
assert.match(style, /:focus-visible\s*\{[^}]*outline:/, "keyboard focus must remain visible");
assert.match(style, /prefers-reduced-motion:\s*reduce/, "reduced-motion preference must be respected");
assert.match(style, /box-shadow:\s*none/, "decorative component shadows should be removed");
assert.match(html, /setWorkspaceLayout\(2\);/, "two-station mode must remain the default");
assert.match(html, /data-layout="4"/, "four-station mode must remain available");
console.log("design-system: verified visual tokens, keyboard focus, reduced motion, restrained shadows, and workspace layouts");
