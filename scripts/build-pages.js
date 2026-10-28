"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const pages = [
  "index.html",
  "planetary.html",
  "osiris.html",
  "trading.html",
  "tillvaxthuset.html",
  "bankkarta.html",
  "newsletter.html",
  "sofia-research.html",
  "varna-sofia-cyprus.html",
  "paraskevi.html",
  "ipo.html"
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of pages) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error("Required Pages asset missing: " + file);
  fs.copyFileSync(source, path.join(output, file));
}

for (const directory of ["assets", "newsletters"]) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(output, directory), { recursive: true });
  }
}

const redirects = [
  "/ /planetary.html 200",
  "/planetary /planetary.html 200",
  "/workspace /index.html 200",
  "/trading /trading.html 200",
  "/trading/tillvaxthuset /tillvaxthuset.html 200",
  "/tillvaxthuset /tillvaxthuset.html 200",
  "/bankkarta /bankkarta.html 200",
  "/newsletter /newsletter.html 200",
  "/briefing /newsletter.html 200",
  "/nyheter /newsletter.html 200",
  "/sofia-research /sofia-research.html 200",
  "/research/sofia /sofia-research.html 200",
  "/varna-sofia-cyprus /varna-sofia-cyprus.html 200",
  "/articles/varna-sofia-cyprus /varna-sofia-cyprus.html 200",
  "/paraskevi /paraskevi.html 200",
  "/articles/the-shrine-of-saint-paraskevi /paraskevi.html 200",
  "/osiris /osiris.html 200",
  "/ipo /ipo.html 200"
].join("\n") + "\n";

fs.writeFileSync(path.join(output, "_redirects"), redirects, "utf8");
console.log("Cloudflare Pages build ready: " + pages.length + " HTML pages plus assets, newsletters and route rewrites.");
