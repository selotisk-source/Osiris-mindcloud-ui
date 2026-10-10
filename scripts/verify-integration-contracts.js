const fs = require("node:fs");
const registry = JSON.parse(fs.readFileSync("integrations/agent-tools.json","utf8"));

const required = [
  "overpass-turbo",
  "geohints",
  "google-street-view",
  "shodan",
  "subdomain-finder",
  "opensanctions",
  "cookies-viewer"
];

for (const id of required) {
  const tool = registry.tools.find(item => item.id === id);
  if (!tool) throw new Error(`missing integration: ${id}`);
  if (!tool.env) throw new Error(`missing env contract: ${id}`);
  if (!Array.isArray(tool.operations) || tool.operations.length === 0) throw new Error(`missing operations: ${id}`);
  if (!tool.layer) throw new Error(`missing layer: ${id}`);
  if (["shodan","subdomain-finder","cookies-viewer"].includes(id) && !tool.security) {
    throw new Error(`missing security policy: ${id}`);
  }
}

console.log(`integration-contracts: verified ${required.length} tool contracts`);
