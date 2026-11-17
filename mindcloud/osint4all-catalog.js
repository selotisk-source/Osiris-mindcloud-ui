"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SOURCE_URL = "https://start.me/p/L1rEYQ/osint4all";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_ITEMS = 500;

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function stripTags(value) { return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim(); }
function safeUrl(raw, base) {
  try {
    const url = new URL(decodeHtml(raw), base);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
function parseCatalogue(html, sourceUrl = DEFAULT_SOURCE_URL) {
  const sourceTitle = (String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "OSINT4ALL";
  const sourceDescription = (String(html).match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || "";
  const links = [];
  const seen = new Set();
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(String(html))) && links.length < MAX_ITEMS) {
    const attrs = match[1] + " " + match[4];
    if (/\b(?:nav|footer|header)\b/i.test(attrs)) continue;
    const href = safeUrl(match[3], sourceUrl);
    const title = stripTags(match[5]).slice(0, 240);
    if (!href || !title || seen.has(href)) continue;
    if (new URL(href).hostname === new URL(sourceUrl).hostname && /\/about(?:\/|$)/i.test(new URL(href).pathname)) continue;
    seen.add(href);
    const before = String(html).slice(Math.max(0, match.index - 1800), match.index);
    const headings = [...before.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
    const category = headings.length ? stripTags(headings[headings.length - 1][1]).slice(0, 100) : "Uncategorized";
    links.push({
      id: "osint4all-" + Buffer.from(href).toString("base64url").slice(0, 18),
      name: title,
      url: href,
      category,
      source: sourceUrl,
      sourceName: "OSINT4ALL",
      access: "discovery-only",
      executionEnabled: false
    });
  }
  return {
    source: sourceUrl,
    title: stripTags(sourceTitle),
    description: stripTags(sourceDescription),
    retrievedAt: new Date().toISOString(),
    count: links.length,
    tools: links
  };
}
async function fetchCatalogue(sourceUrl = process.env.OSINT4ALL_CATALOG_URL || DEFAULT_SOURCE_URL) {
  const url = safeUrl(sourceUrl, DEFAULT_SOURCE_URL);
  if (!url || new URL(url).hostname !== "start.me") throw new Error("osint4all_source_not_allowed");
  const response = await fetch(url, {
    headers: { accept: "text/html,application/xhtml+xml", "user-agent": "MindCloud-OSINT4ALL-Registry/1.0" },
    signal: AbortSignal.timeout(8000),
    redirect: "error"
  });
  if (!response.ok) throw new Error("osint4all_http_" + response.status);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("osint4all_response_too_large");
  const catalogue = parseCatalogue(text, url);
  if (!catalogue.count) throw new Error("osint4all_catalogue_empty");
  return catalogue;
}
function loadOefaFallback() {
  const file = path.join(__dirname, "..", "integrations", "oefa-registry.json");
  const registry = JSON.parse(fs.readFileSync(file, "utf8"));
  const tools = registry.entries.map(entry => ({
    id: entry.id, name: entry.name, url: null, category: entry.category,
    source: "oefa://internal-registry", sourceName: "OEFA",
    access: entry.execution_enabled ? "mindcloud-adapter" : "reference-only",
    adapter: entry.adapter, executionEnabled: entry.execution_enabled === true
  }));
  return { source: "oefa://internal-registry", title: "OEFA internal capability register", description: registry.role, retrievedAt: new Date().toISOString(), count: tools.length, tools, fallback: true };
}
function searchCatalogue(catalogue, query = "", limit = 50) {
  const terms = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const tools = catalogue.tools.filter(tool => {
    const haystack = [tool.name, tool.url, tool.category].join(" ").toLowerCase();
    return terms.every(term => haystack.includes(term));
  }).slice(0, boundedLimit);
  return { ...catalogue, count: tools.length, totalAvailable: catalogue.tools.length, tools };
}
module.exports = { DEFAULT_SOURCE_URL, parseCatalogue, fetchCatalogue, searchCatalogue, loadOefaFallback };
