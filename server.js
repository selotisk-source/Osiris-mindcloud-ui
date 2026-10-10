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

async function cogneeMemoryRoundTrip() {
  const endpoint = (process.env.COGNEE_SERVICE_URL || "").replace(/\/$/, "");
  if (!endpoint) return {status:"not_configured",persisted:false};
  const sessionId = "mindcloud-e2e-persistence-probe";
  const marker = "MINDCLOUD_PERSISTENCE_PROBE_V1";
  const datasetName = process.env.COGNEE_MEMORY_DATASET || "mindcloud-selftest";
  const parseResponse = async response => {
    try { return await response.json(); }
    catch { return {raw:await response.text().catch(()=> "")}; }
  };
  const recall = async () => {
    const response = await fetch(endpoint + "/api/v1/recall", {
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify({query:marker,session_id:sessionId,scope:"session",only_context:true,top_k:5}),
      signal:AbortSignal.timeout(10000)
    });
    return {response,body:await parseResponse(response)};
  };
  const containsMarker = body => JSON.stringify(body).includes(marker);
  try {
    const existing = await recall();
    if (existing.response.ok && containsMarker(existing.body)) {
      return {status:"healthy",persisted:true,mode:"existing-readback",sessionId};
    }
    const form = new FormData();
    form.append("raw_data",marker);
    form.append("datasetName",datasetName);
    form.append("session_id",sessionId);
    form.append("self_improvement","false");
    form.append("run_in_background","false");
    const writeResponse = await fetch(endpoint + "/api/v1/remember", {
      method:"POST",
      headers:{accept:"application/json"},
      body:form,
      signal:AbortSignal.timeout(20000)
    });
    const writeBody = await parseResponse(writeResponse);
    if (!writeResponse.ok) {
      return {status:"degraded",persisted:false,mode:"write-failed",httpStatus:writeResponse.status,detail:writeBody};
    }
    const readback = await recall();
    const persisted = readback.response.ok && containsMarker(readback.body);
    return {
      status:persisted ? "healthy" : "degraded",
      persisted,
      mode:"write-readback",
      writeHttpStatus:writeResponse.status,
      readHttpStatus:readback.response.status,
      sessionId,
      ...(persisted ? {} : {detail:readback.body})
    };
  } catch (error) {
    return {status:"offline",persisted:false,error:error instanceof Error ? error.message : String(error)};
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
  const memoryRoundTrip = memory.status === "healthy" ? await cogneeMemoryRoundTrip() : {status:memory.status,persisted:false};
  const browserUse = await adapters.health("browser-use");
  const browserExecution = browserUse.status === "healthy"
    ? await adapters.execute({id:"browser-use",operation:"browse",input:{url:"https://example.com",sessionId:"mindcloud-e2e-selftest",waitUntil:"domcontentloaded",timeout:15000}})
    : {ok:false,error:"browser_use_not_healthy"};
  const browserExecutionOk = Boolean(browserExecution.ok && browserExecution.result?.status === "executed" && browserExecution.result?.httpStatus >= 200 && browserExecution.result?.httpStatus < 400);
  const coreChecks = [
    {id:"task-routed",ok:Boolean(routeResult && routeResult.taskId === taskId && routeResult.status === "routed")},
    {id:"task-readable",ok:snapshot.tasks.some(task => task.taskId === taskId)},
    {id:"event-emitted",ok:events.some(event => event.taskId === taskId && event.type === "complete")},
    {id:"tool-catalog-loaded",ok:Array.isArray(agentTools.tools) && agentTools.tools.length >= 10}
  ];
  const integrationChecks = [
    {id:"cognee-memory-health",ok:memory.status === "healthy",status:memory.status},
    {id:"cognee-memory-persistence",ok:memoryRoundTrip.status === "healthy" && memoryRoundTrip.persisted === true,status:memoryRoundTrip.status,mode:memoryRoundTrip.mode || null},
    {id:"browser-use-health",ok:browserUse.status === "healthy",status:browserUse.status,browserEngine:browserUse.browserEngine || null},
    {id:"browser-use-execution",ok:browserExecutionOk,status:browserExecution.ok ? "executed" : browserExecution.error || "failed",httpStatus:browserExecution.result?.httpStatus ?? browserExecution.status ?? null}
  ];
  const coreOk = coreChecks.every(check => check.ok);
  const integrationsOk = integrationChecks.every(check => check.ok);
  return {
    type:"mindcloud_e2e_selftest",
    status:coreOk && integrationsOk ? "passed" : coreOk ? "degraded" : "failed",
    taskId,
    core:{status:coreOk ? "passed" : "failed",checks:coreChecks,error:routeError},
    integrations:{
      status:integrationsOk ? "passed" : "degraded",
      checks:integrationChecks,
      memory,
      memoryRoundTrip,
      browserUse,
      browserExecution:browserExecutionOk ? {
        status:"executed",
        httpStatus:browserExecution.result.httpStatus,
        title:browserExecution.result.title,
        url:browserExecution.result.url,
        sessionId:browserExecution.result.sessionId
      } : {
        status:"failed",
        error:browserExecution.error || browserExecution.result?.error || "browser_execution_failed",
        message:browserExecution.result?.message || null
      }
    },
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
  if(pathname==="/api/adapters/execute" && req.method==="POST"){
    const expectedToken = process.env.MINDCLOUD_TOOL_EXECUTION_TOKEN || "";
    const suppliedToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!expectedToken || !suppliedToken || suppliedToken.length !== expectedToken.length ||
        !require("node:crypto").timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(expectedToken))) {
      sendJson(res,{ok:false,error:"unauthorized"},401); return;
    }
    try {
      const task = await readJson(req);
      if (!task || typeof task.id !== "string" || typeof task.operation !== "string") {
        sendJson(res,{ok:false,error:"invalid_adapter_request"},400); return;
      }
      const tool = agentTools.tools.find(item => item.id === task.id);
      if (!tool) { sendJson(res,{ok:false,error:"adapter_not_found"},404); return; }
      // Client-provided approval is never trusted. Security-gated tools remain blocked
      // until a server-side human-approval workflow supplies a trusted approval record.
      const approved = !tool.security;
      sendJson(res,await adapters.execute({...task,approved}));
    } catch(error) {
      sendJson(res,{ok:false,error:error instanceof Error?error.message:String(error)},400);
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
server.listen(port,"0.0.0.0",()=>{
  console.log("OSIRIS MindCloud listening on port "+port);
  runMindcloudSelfTest()
    .then(result=>console.log("MINDCLOUD_E2E_SELFTEST "+JSON.stringify(result)))
    .catch(error=>console.error("MINDCLOUD_E2E_SELFTEST_FAILED "+String(error?.message||error)));
});
