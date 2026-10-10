const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createRouterNetwork } = require("./mindcore/router-network");
const { MindCloudRuntime } = require("./mindcloud/runtime");

const routerNetwork = createRouterNetwork();
const mindcloud = new MindCloudRuntime();
const port = Number(process.env.PORT || 3000);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const tradingHtml = fs.readFileSync(path.join(__dirname, "trading.html"), "utf8");
const newsletterHtml = fs.readFileSync(path.join(__dirname, "newsletter.html"), "utf8");
const agentTools = JSON.parse(fs.readFileSync(path.join(__dirname, "integrations", "agent-tools.json"), "utf8"));
const { inspectAll: inspectToolHealth } = require("./integrations/tool-health");
const toolHealth = require("./integrations/tool-health");

function sendJson(res, data, status=200) {
  res.writeHead(status, {"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
  res.end(JSON.stringify(data));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error("request_too_large"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("invalid_json")); }
    });
    req.on("error", reject);
  });
}
function cctvResponse() {
  const source = process.env.CCTV_SOURCE_URL || null;
  const publicAccess = process.env.CCTV_PUBLIC_ACCESS === "true";
  let protocol = null;
  try { protocol = source ? new URL(source).protocol.replace(":", "").toUpperCase() : null; } catch {}
  return {
    status: source ? "configured" : "not_configured",
    service: "osiris-mindcloud-ui",
    endpoint: "/api/cctv",
    source: source ? "configured" : null,
    streamProtocol: protocol,
    streamStatus: source ? "configured" : "unconfigured",
    proxyStatus: "not_implemented",
    access: source ? (publicAccess ? "public" : "osiris-controlled") : "unconfigured"
  };
}
async function cogneeHealth() {
  const endpoint = (process.env.COGNEE_SERVICE_URL || "").replace(/\/$/, "");
  if (!endpoint) return {status:"not_configured",endpoint:null};
  try {
    const response = await fetch(endpoint + "/health", {signal:AbortSignal.timeout(2500)});
    return {status:response.ok ? "healthy" : "degraded",endpoint,httpStatus:response.status};
  } catch (error) {
    return {status:"offline",endpoint,error:error instanceof Error ? error.message : String(error)};
  }
}
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, "http://"+(req.headers.host||"localhost"));
  const pathname = url.pathname;
  if(pathname==="/trading"||pathname==="/trading/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(tradingHtml);return;}
  if(pathname==="/newsletter"||pathname==="/newsletter/"||pathname==="/nyheter"||pathname==="/nyheter/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(newsletterHtml);return;}
  if(pathname==="/health"){sendJson(res,{status:"ok",service:"osiris-mindcloud-ui"});return;}
  if(pathname==="/api/mindcloud/status"){sendJson(res,mindcloud.snapshot());return;}
  if(pathname==="/api/mindcloud/capabilities"){sendJson(res,{type:"mindcloud_capability_graph",layers:mindcloud.snapshot().capabilityLayers,recipes:mindcloud.snapshot().recipes});return;}
  if(pathname==="/api/mindcloud/suggest"){sendJson(res,mindcloud.route({taskId:"suggestion-preview",kind:url.searchParams.get("kind")||"general",goal:url.searchParams.get("goal")||""}));return;}
  if(pathname==="/api/mindcloud/route" && req.method==="POST"){
    try {
      const task = await readJson(req);
      if (!task || typeof task !== "object") return sendJson(res,{error:"invalid_task"},400);
      if (!task.taskId) task.taskId = "task-" + Date.now();
      sendJson(res,mindcloud.route(task));
    } catch (error) { sendJson(res,{error:error instanceof Error ? error.message : String(error)},400); }
    return;
  }
  if(pathname==="/api/mindcloud/events"){sendJson(res,{type:"mindcloud_events",events:mindcloud.eventsFor(url.searchParams.get("taskId")||undefined)});return;}
  if(pathname==="/api/router"){const kind=url.searchParams.get("kind")||"general";sendJson(res,{network:routerNetwork.snapshot(),route:routerNetwork.route({taskId:"ui-route",kind})});return;}
  if(pathname==="/api/agent-tools"){sendJson(res,agentTools);return;}
  if(pathname==="/api/agent-tools/health"){sendJson(res,inspectToolHealth());return;}
  if(pathname==="/api/agent-tools/execute" && req.method==="POST"){
    const expectedToken = process.env.MINDCLOUD_TOOL_EXECUTION_TOKEN || "";
    const suppliedToken = (req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
    if (!expectedToken) return sendJson(res,{error:"tool_execution_disabled",reason:"execution_token_not_configured"},503);
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return sendJson(res,{error:"unauthorized"},401);
    }
    try {
      const body = await readJson(req);
      const toolId = typeof body.toolId === "string" ? body.toolId : "";
      const operation = typeof body.operation === "string" ? body.operation : "";
      const health = toolHealth.inspectAll().tools.find(tool => tool.id === toolId);
      if (!health || health.status === "DISCOVERY-ONLY" || health.status === "PLANNED") {
        return sendJson(res,{error:"tool_not_executable",toolId,status:health?.status||"UNKNOWN"},409);
      }
      if (!health.adapter) return sendJson(res,{error:"adapter_missing",toolId},409);
      const adapterPath = path.join(__dirname, health.adapter);
      const adapter = require(adapterPath);
      if (typeof adapter.execute !== "function") return sendJson(res,{error:"adapter_execute_missing",toolId},409);
      const result = await adapter.execute(operation, body.input && typeof body.input === "object" ? body.input : {});
      sendJson(res,{type:"mindcloud_tool_execution",toolId,operation,result});
    } catch (error) {
      sendJson(res,{type:"mindcloud_tool_execution",status:"failed",error:error instanceof Error ? error.message : String(error),code:error?.code||null},502);
    }
    return;
  }
  if(pathname==="/api/capabilities"){sendJson(res,{type:"mindcloud_capability_registry",source:"MindCore",capabilities:routerNetwork.geospatialCapabilities.list()});return;}
  if(pathname==="/api/liveness/route"){sendJson(res,{type:"mindcloud_live_liveness",capability:"route-variation",status:"available",policy:"safety-first-accessibility-second-controlled-variation",humanApprovalRequired:true});return;}
  if(pathname==="/api/cctv"){sendJson(res,cctvResponse());return;}
  if(pathname==="/api/memory/health"){cogneeHealth().then(result=>sendJson(res,result)).catch(error=>sendJson(res,{status:"error",error:String(error)},500));return;}
  if(pathname==="/api/runtime/status"){
    cogneeHealth().then(memory=>sendJson(res,{
      type:"mindcloud_runtime_status",
      service:"osiris-mindcloud-ui",
      health:"ok",
      cctv:cctvResponse(),
      memory,
      mindcloud:mindcloud.snapshot(),
      capabilities:routerNetwork.geospatialCapabilities.list()
    })).catch(error=>sendJson(res,{type:"mindcloud_runtime_status",health:"degraded",error:String(error)},500));
    return;
  }
  if(pathname==="/newsletters/index.json"||pathname.startsWith("/newsletters/")){
    const relative=pathname.replace(/^\/+/, "");
    const root=path.join(__dirname,"newsletters"), file=path.join(__dirname,relative);
    if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=60"});res.end(fs.readFileSync(file));return;}
    sendJson(res,{error:"newsletter_not_found"},404);return;
  }
  res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);
});
server.listen(port,"0.0.0.0",()=>console.log("OSIRIS MindCloud listening on port "+port));
