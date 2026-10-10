const fs = require("node:fs");
const registry = JSON.parse(fs.readFileSync("integrations/agent-tools.json","utf8"));
const extensionManifest = JSON.parse(fs.readFileSync("extension/manifest.json","utf8"));
const sidepanel = fs.readFileSync("extension/sidepanel.html","utf8");

const required = [
  "overpass-turbo",
  "geohints",
  "google-street-view",
  "mapillary",
  "shodan",
  "subdomain-finder",
  "opensanctions",
  "cookies-viewer",
  "agentmemory"
];

const incomingTools = ["watermelon-ui","watermelon-ai","manus-ai","punkt-ai"];
for (const id of incomingTools) {
  const tool = registry.tools.find(item => item.id === id);
  if (!tool) throw new Error(`missing incoming toolbox candidate: ${id}`);
  if (!tool.source_url || !tool.layer || !tool.cost_model || !Array.isArray(tool.operations) || !tool.operations.length) {
    throw new Error(`incomplete incoming toolbox metadata: ${id}`);
  }
  if (["watermelon-ai","punkt-ai"].includes(id) && tool.status !== "research-registered") {
    throw new Error(`unverified product must remain research-registered: ${id}`);
  }
  if (id === "watermelon-ui" && tool.status !== "registered-only") throw new Error("Watermelon UI must not claim an executable adapter");
  if (id === "manus-ai" && (tool.status !== "parked-integration-review" || tool.env !== "MANUS_API_KEY" || !tool.api_docs)) {
    throw new Error("Manus must remain parked until its supervised adapter is implemented and tested");
  }
}

for (const id of required) {
  const tool = registry.tools.find(item => item.id === id);
  if (!tool) throw new Error(`missing integration: ${id}`);
  if (!tool.env && !["subdomain-finder","cookies-viewer"].includes(id)) throw new Error(`missing env contract: ${id}`);
  if (["google-street-view","shodan","opensanctions"].includes(id) && !tool.env.endsWith("_API_KEY")) throw new Error(`native adapter credential contract mismatch: ${id}`);
  if (["google-street-view","shodan","opensanctions"].includes(id) && !tool.endpoint_env) throw new Error(`missing endpoint override contract: ${id}`);
  if (!Array.isArray(tool.operations) || tool.operations.length === 0) throw new Error(`missing operations: ${id}`);
  if (!tool.layer) throw new Error(`missing layer: ${id}`);
  if (!tool.cost_model) throw new Error(`missing cost model: ${id}`);
  if (id === "subdomain-finder" && tool.cost_model !== "free-public-endpoints-no-key") throw new Error("subdomain finder must remain on free public endpoints");
  if (id === "subdomain-finder" && tool.authorization_env !== "MINDCLOUD_AUTHORIZED_DOMAINS") throw new Error("subdomain finder must require a server-owned domain allowlist");
  if (id === "mapillary" && tool.cost_model !== "free-no-subscription") throw new Error("Mapillary alternative must remain subscription-free");
  if (id === "google-street-view" && tool.status !== "parked-cost-review") throw new Error("Google Street View must remain parked pending cost review");
  if (id === "shodan" && tool.status !== "parked-cost-review") throw new Error("Shodan must remain parked pending cost review");
  if (id === "opensanctions" && tool.status !== "parked-cost-review") throw new Error("OpenSanctions hosted API must remain parked pending license/cost review");
  if (id === "cookies-viewer" && tool.transport !== "extension-local") throw new Error("cookie viewer must remain local to the browser extension");
  if (id === "agentmemory" && tool.transport !== "native-http") throw new Error("AgentMemory must use the native Cognee HTTP adapter");
  if (id === "agentmemory" && JSON.stringify(tool.operations) !== JSON.stringify(["remember","observe","smart_search","context"])) throw new Error("AgentMemory must advertise only implemented memory operations");
  if (id === "agentmemory" && tool.env !== "COGNEE_SERVICE_URL") throw new Error("AgentMemory must use the existing Cognee service URL");
  if (["shodan","subdomain-finder","cookies-viewer"].includes(id) && !tool.security) {
    throw new Error(`missing security policy: ${id}`);
  }
}

if (!extensionManifest.optional_permissions?.includes("cookies")) throw new Error("cookie viewer must request optional cookies permission");
if (!extensionManifest.optional_host_permissions?.includes("https://*/*")) throw new Error("cookie viewer must request host access per site, not globally");
if (!sidepanel.includes("chrome.cookies.getAll({url:tab.url})")) throw new Error("cookie viewer must scope to the active tab URL");
if (!sidepanel.includes("cookies.map(({name,domain,path,secure,httpOnly,sameSite,session,expirationDate})")) throw new Error("cookie viewer must expose metadata only");
if (sidepanel.includes("cookie.value")) throw new Error("cookie values must never be read into UI output");
console.log(`integration-contracts: verified ${required.length} existing tool contracts, ${incomingTools.length} incoming toolbox candidates, AgentMemory/Cognee wiring and local cookie privacy policy`);
