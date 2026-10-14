const fs = require("node:fs");
const path = require("node:path");
const article = fs.readFileSync(path.join(__dirname, "..", "paraskevi.html"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const newsletter = fs.readFileSync(path.join(__dirname, "..", "newsletter.html"), "utf8");
const workspace = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const svgPath = path.join(__dirname, "..", "assets", "paraskevi-shrine.svg");
const checks = [
  ["standalone article exists", article.includes("<title>The Shrine of Saint Paraskevi")],
  ["Bulgarian Petka feast is correctly dated 14 October", article.includes("14 oktober") && article.includes("14 OKTOBER")],
  ["Roman martyr feast is separately dated 26 July", article.toLowerCase().includes("26 juli")],
  ["the two saints are explicitly distinguished", article.includes("två olika helgon") && article.includes("inte två datum för samma person")],
  ["interpretation is separated from church tradition", article.includes("vår egen moderna tolkning") && article.includes("inte en kyrklig lära")],
  ["official Bulgarian Patriarchate source is linked", article.includes("https://bg-patriarshia.bg/sv-petka")],
  ["Orthodox Church in America source is linked", article.includes("https://www.oca.org/saints/lives/1977/07/26/102096-martyr-paraskevi-of-rome")],
  ["standalone article route is served", server.includes('pathname==="/paraskevi"') && server.includes("paraskevi.html")],
  ["SVG asset route is served", server.includes("image/svg+xml") && fs.existsSync(svgPath) && article.includes('/assets/paraskevi-shrine.svg')],
  ["article linked from workspace navigation", workspace.includes('href="/paraskevi">The Shrine')],
  ["article linked from briefing navigation", newsletter.includes('href="/paraskevi">The Shrine')]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? "PASS" : "FAIL") + " " + name);
if (failed.length) process.exitCode = 1;
