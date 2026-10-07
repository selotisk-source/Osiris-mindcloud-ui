const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRouterNetwork } = require("./mindcore/router-network");

const routerNetwork = createRouterNetwork();
const port = Number(process.env.PORT || 3000);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const agentTools = JSON.parse(fs.readFileSync(path.join(__dirname, "integrations", "agent-tools.json"), "utf8"));

function cctvResponse() {
  const source = process.env.CCTV_SOURCE_URL || null;
  const publicAccess = process.env.CCTV_PUBLIC_ACCESS === "true";
  return {
    status: source ? "configured" : "not_configured",
    service: "osiris-mindcloud-ui",
    endpoint: "/api/cctv",
    source: source ? "configured" : null,
    streamStatus: source ? "configured" : "unconfigured",
    proxyStatus: "not_implemented",
    access: source ? (publicAccess ? "public" : "osiris-controlled") : "unconfigured"
  };
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok", service: "osiris-mindcloud-ui" }));
    return;
  }
  if (req.url.startsWith("/api/router")) {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const kind = url.searchParams.get("kind") || "general";
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      network: routerNetwork.snapshot(),
      route: routerNetwork.route({ taskId: "ui-route", kind })
    }));
    return;
  }
  if (req.url === "/api/agent-tools") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(agentTools));
    return;
  }
  if (req.url === "/api/capabilities") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      type: "mindcloud_capability_registry",
      source: "MindCore",
      capabilities: routerNetwork.geospatialCapabilities.list()
    }));
    return;
  }
  if (req.url === "/api/liveness/route") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      type: "mindcloud_live_liveness",
      capability: "route-variation",
      status: "available",
      policy: "safety-first-accessibility-second-controlled-variation",
      humanApprovalRequired: true
    }));
    return;
  }
  if (req.url === "/api/cctv") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(cctvResponse()));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(port, "0.0.0.0", () => {
  console.log("OSIRIS MindCloud listening on port " + port);
});
