const fs = require("node:fs");
const article = fs.readFileSync("sofia-research.html", "utf8");
const frontend = fs.readFileSync("frontend-server.js", "utf8");
const workspace = fs.readFileSync("index.html", "utf8");
const briefing = fs.readFileSync("newsletter.html", "utf8");
const shrine = fs.readFileSync("paraskevi.html", "utf8");
const checks = [
  ["Sofia field research page exists", article.includes("Sofia — Historisk fältundersökning")],
  ["production frontend maps Sofia routes", frontend.includes('"/sofia-research": ["sofia-research.html"') && frontend.includes('"/research/sofia": ["sofia-research.html"')],
  ["workspace links to Sofia research", workspace.includes('href="/sofia-research">Sofia Research</a>')],
  ["briefing links to Sofia research", briefing.includes('href="/sofia-research">Sofia Research</a>')],
  ["Shrine article links to Sofia research", shrine.includes('href="/sofia-research">Sofia Research</a>')],
  ["Serdika, St George and St Sophia are separate field anchors", article.includes("Ancient Serdika") && article.includes("Sankt Georgs rotunda") && article.includes("Sankt Sofia och nekropolen")],
  ["Tsar Samuel and Vlad III have separate identity records", article.includes("Tsar Samuel av Bulgarien") && article.includes("Vlad III Țepeș") && article.includes("aldrig återanvändas")],
  ["Macarios III remains explicitly unresolved", article.includes("Identifikation kräver källa") && article.includes("Namnet är inte tillräckligt")],
  ["hypotheses are separated from observations", article.includes("observation är inte automatiskt bevis") && article.includes("Hypotes") && article.includes("Olöst")]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? "PASS " : "FAIL ") + name);
if (failed.length) process.exitCode = 1;
