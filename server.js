const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRouterNetwork } = require("./mindcore/router-network");
const { MindCloudRuntime } = require("./mindcloud/runtime");
const { AdapterRuntime } = require("./mindcloud/adapter-runtime");

const routerNetwork = createRouterNetwork();
const mindcloud = new MindCloudRuntime();
const port = Number(process.env.PORT || 3000);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const tradingHtml = fs.readFileSync(path.join(__dirname, "trading.html"), "utf8");
const newsletterHtml = fs.readFileSync(path.join(__dirname, "newsletter.html"), "utf8");
const agentTools = JSON.parse(fs.readFileSync(path.join(__dirname, "integrations", "agent-tools.json"), "utf8"));
const adapters = new AdapterRuntime(agentTools);

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

async function runMindcloudSelfTest() {
  const taskId = "selftest-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  let routeResult = null;
  let routeError = null;
  try {
    routeResult = mindcloud.route({taskId,kind:"research",goal:"MindCloud end-to-end self-test"});
  } catch (error) {
    routeError = error instanceof Error ? error.message : String(error);
  }
  const snapshot = mindcloud.snapshot();
  const events = mindcloud.eventsFor(taskId);
  const memory = await cogneeHealth();
  const browserUse = await adapters.health("browser-use");
  const coreChecks = [
    {id:"task-routed",ok:Boolean(routeResult && routeResult.taskId === taskId && routeResult.status === "routed")},
    {id:"task-readable",ok:snapshot.tasks.some(task => task.taskId === taskId)},
    {id:"event-emitted",ok:events.some(event => event.taskId === taskId && event.type === "complete")},
    {id:"tool-catalog-loaded",ok:Array.isArray(agentTools.tools) && agentTools.tools.length >= 10}
  ];
  const integrationChecks = [
    {id:"cognee-memory",ok:memory.status === "healthy",status:memory.status},
    {id:"browser-use",ok:browserUse.status === "healthy",status:browserUse.status}
  ];
  const coreOk = coreChecks.every(check => check.ok);
  const integrationsOk = integrationChecks.every(check => check.ok);
  return {
    type:"mindcloud_e2e_selftest",
    status:coreOk && integrationsOk ? "passed" : coreOk ? "degraded" : "failed",
    taskId,
    core:{status:coreOk ? "passed" : "failed",checks:coreChecks,error:routeError},
    integrations:{status:integrationsOk ? "passed" : "degraded",checks:integrationChecks,memory,browserUse},
    optional:{cctv:cctvResponse()},
    timestamp:new Date().toISOString()
  };
}
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, "http://"+(req.headers.host||"localhost"));
  const pathname = url.pathname;
  if(pathname==="/trading"||pathname==="/trading/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(tradingHtml);return;}
  if(pathname==="/newsletter"||pathname==="/newsletter/"||pathname==="/briefing"||pathname==="/briefing/"||pathname==="/nyheter"||pathname==="/nyheter/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(newsletterHtml);return;}
  if(pathname==="/health"){sendJson(res,{status:"ok",service:"osiris-mindcloud-ui"});return;}
  if(pathname==="/api/mindcloud/status"){sendJson(res,mindcloud.snapshot());return;}
  if(pathname==="/api/mindcloud/selftest" && req.method==="POST"){
    try { sendJson(res,await runMindcloudSelfTest()); }
    catch (error) { sendJson(res,{type:"mindcloud_e2e_selftest",status:"failed",error:error instanceof Error ? error.message : String(error)},500); }
    return;
  }
  if(pathname==="/api/mindcloud/capabilities"){sendJson(res,{type:"mindcloud_capability_graph",layers:mindcloud.snapshot().capabilityLayers,recipes:mindcloud.snapshot().recipes});return;}
  if(pathname==="/api/mindcloud/suggest"){const task={kind:url.searchParams.get("kind")||"general",goal:url.searchParams.get("goal")||""};sendJson(res,{type:"mindcloud_suggestion",...require("./mindcloud/capability-graph").suggest(task)});return;}
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
  if(pathname==="/api/adapters"){sendJson(res,adapters.snapshot());return;}
  if(pathname.startsWith("/api/adapters/") && pathname.endsWith("/discover")){const id=pathname.split("/")[3];sendJson(res,adapters.discover(id));return;}
  if(pathname.startsWith("/api/adapters/") && pathname.endsWith("/health")){const id=pathname.split("/")[3];adapters.health(id).then(result=>sendJson(res,result));return;}
  if(pathname==="/api/adapters/execute" && req.method==="POST"){try{const task=await readJson(req);sendJson(res,await adapters.execute(task));}catch(error){sendJson(res,{ok:false,error:error instanceof Error?error.message:String(error)},400);}return;}
  if(pathname==="/api/capabilities"){sendJson(res,{type:"mindcloud_capability_registry",source:"MindCore",capabilities:routerNetwork.geospatialCapabilities.list()});return;}
  if(pathname==="/api/liveness/route"){sendJson(res,{type:"mindcloud_live_liveness",capability:"route-variation",status:"available",policy:"safety-first-accessibility-second-controlled-variation",humanApprovalRequired:true});return;}
  if(pathname==="/api/cctv"){sendJson(res,cctvResponse());return;}
  if(pathname==="/api/memory/health"){cogneeHealth().then(result=>sendJson(res,result)).catch(error=>sendJson(res,{status:"error",error:String(error)},500));return;}
  if(pathname==="/api/runtime/status"){
    cogneeHealth().then(memory=>sendJson(res,{
      type:"mindcloud_runtime_status",
      service:"osiris-mindcloud-ui",
      health:memory.status==="healthy" ? "ok" : "degraded",
      coreHealth:"ok",
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
  if(pathname.startsWith("/api/")){sendJson(res,{error:"api_route_not_found",path:pathname},404);return;}
  res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);
});
server.listen(port,"0.0.0.0",()=>console.log("OSIRIS MindCloud listening on port "+port));
