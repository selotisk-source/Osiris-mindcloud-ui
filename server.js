const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createRouterNetwork } = require("./mindcore/router-network");
const { createAgentCluster } = require("./mindcore/agent-cluster");
const { createProviderNetwork } = require("./mindcore/provider-network");
const providerNetwork = createProviderNetwork();
const agentCluster = createAgentCluster();
const { MindCloudRuntime } = require("./mindcloud/runtime");
const { AdapterRuntime } = require("./mindcloud/adapter-runtime");
const { proxyCctvRequest } = require("./mindcloud/cctv-proxy");
const { evaluateMetanoia } = require("./mindcloud/metanoia-engine");
const { evaluateDecision } = require("./mindcloud/decision-governor");
const { listMandates, evaluateMandate } = require("./mindcloud/mandate-manager");
const { evaluateArena } = require("./mindcore/arena-skill");
const { runArenaWorkflow } = require("./mindcloud/arena-workflow");
const { EvidenceGraph } = require("./mindcloud/evidence-graph");

const routerNetwork = createRouterNetwork();
const mindcloud = new MindCloudRuntime();
const evidenceGraph = new EvidenceGraph();
const port = Number(process.env.PORT || 3000);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const tradingHtml = fs.readFileSync(path.join(__dirname, "trading.html"), "utf8");
const newsletterHtml = fs.readFileSync(path.join(__dirname, "newsletter.html"), "utf8");
const agentTools = JSON.parse(fs.readFileSync(path.join(__dirname, "integrations", "agent-tools.json"), "utf8"));
const approvalRequests = new Map();
const approvalAudit = [];
const metanoiaReports = new Map();
const METANOIA_REPORT_TTL_MS = 10 * 60 * 1000;
function rememberMetanoiaReport(report) {
  const now = Date.now();
  for (const [hash, entry] of metanoiaReports) {
    if (now > entry.expiresAt) metanoiaReports.delete(hash);
  }
  while (metanoiaReports.size >= 100) metanoiaReports.delete(metanoiaReports.keys().next().value);
  metanoiaReports.set(report.reportHash, {
    report: structuredClone(report),
    createdAt: now,
    expiresAt: now + METANOIA_REPORT_TTL_MS,
    consumed: false
  });
}

function tokenMatches(supplied, expected) {
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  return require("node:crypto").timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
function bearerToken(req) { return (req.headers.authorization || "").replace(/^Bearer\s+/i, ""); }
function isExecutionAuthorized(req) {
  return tokenMatches(bearerToken(req), process.env.MINDCLOUD_TOOL_EXECUTION_TOKEN || "");
}
function isApprovalAuthorized(req) {
  return tokenMatches(bearerToken(req), process.env.MINDCLOUD_APPROVAL_TOKEN || "");
}
function canonicalApprovalInput(value) {
  if (Array.isArray(value)) return value.map(canonicalApprovalInput);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalApprovalInput(value[key])]));
  }
  return value;
}
function approvalInputHash(input) {
  const canonical = JSON.stringify(canonicalApprovalInput(input ?? {}));
  return require("node:crypto").createHash("sha256").update(canonical).digest("hex");
}
function createApprovalRequest(tool, operation, input) {
  const id = require("node:crypto").randomUUID();
  const createdAt = new Date().toISOString();
  const normalizedInput = input === undefined ? {} : input;
  const ticket = {id,toolId:tool.id,operation,inputHash:approvalInputHash(normalizedInput),inputSummary:JSON.stringify(normalizedInput).slice(0,1000),status:"pending",createdAt,expiresAt:new Date(Date.now()+10*60*1000).toISOString()};
  approvalRequests.set(id,ticket);
  approvalAudit.push({type:"requested",approvalId:id,toolId:tool.id,operation,timestamp:createdAt});
  return ticket;
}
function decideApproval(id, decision, reason) {
  const ticket = approvalRequests.get(id);
  if (!ticket) return {error:"approval_not_found"};
  if (ticket.status !== "pending") return {error:"approval_not_pending",status:ticket.status};
  if (Date.now() > Date.parse(ticket.expiresAt)) {
    ticket.status="expired";
    approvalAudit.push({type:"expired",approvalId:id,timestamp:new Date().toISOString()});
    return {error:"approval_expired"};
  }
  if (decision !== "approved" && decision !== "rejected") return {error:"invalid_decision"};
  ticket.status=decision;
  ticket.decidedAt=new Date().toISOString();
  ticket.reason=String(reason || "").slice(0,1000);
  approvalAudit.push({type:decision,approvalId:id,toolId:ticket.toolId,operation:ticket.operation,reason:ticket.reason,timestamp:ticket.decidedAt});
  return ticket;
}
function consumeApproval(id, toolId, operation, input) {
  const ticket = approvalRequests.get(String(id || ""));
  if (!ticket || ticket.status !== "approved" || ticket.toolId !== toolId || ticket.operation !== operation) return false;
  if (!ticket.inputHash || ticket.inputHash !== approvalInputHash(input === undefined ? {} : input)) {
    approvalAudit.push({type:"input_mismatch",approvalId:ticket.id,toolId,operation,timestamp:new Date().toISOString()});
    return false;
  }
  if (Date.now() > Date.parse(ticket.expiresAt)) {
    ticket.status="expired";
    approvalAudit.push({type:"expired",approvalId:ticket.id,timestamp:new Date().toISOString()});
    return false;
  }
  ticket.status="consumed";
  ticket.consumedAt=new Date().toISOString();
  approvalAudit.push({type:"consumed",approvalId:ticket.id,toolId,operation,timestamp:ticket.consumedAt});
  return true;
}
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
function isAuthorizedSubdomainScope(domain) {
  const value = String(domain || "").trim().toLowerCase().replace(/\.$/, "");
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) return false;
  const allowed = (process.env.MINDCLOUD_AUTHORIZED_DOMAINS || "").split(",").map(item => item.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean);
  return allowed.some(root => value === root || value.endsWith("." + root));
}
let cctvSnapshotState = {status:"not_checked",verified:false};

function cctvResponse() {
  const source = process.env.CCTV_SOURCE_URL || null;
  let protocol = null;
  try { protocol = source ? new URL(source).protocol.replace(":", "").toUpperCase() : null; } catch {}
  return {
    status: source ? "configured" : "not_configured",
    service: "osiris-mindcloud-ui",
    endpoint: "/api/cctv",
    source: source ? "configured" : null,
    streamProtocol: protocol,
    streamStatus: source ? "unverified" : "unconfigured",
    proxyStatus: "implemented",
    proxyAuthStatus: process.env.CCTV_PROXY_TOKEN ? "configured" : "credentials-missing",
    frameStatus: !source ? "unconfigured" : cctvSnapshotState.verified ? "verified" : (/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(source) ? "unverified" : "not_implemented"),
    evidenceStatus: !source ? "unavailable" : cctvSnapshotState.verified ? "snapshot-hash-recorded" : "not_verified",
    snapshotStatus: source ? cctvSnapshotState.status : "not_configured",
    snapshotCheckedAt: cctvSnapshotState.checkedAt || null,
    snapshotContentType: cctvSnapshotState.contentType || null,
    snapshotByteLength: cctvSnapshotState.byteLength || null,
    snapshotSha256: cctvSnapshotState.sha256 || null,
    access: source ? "osiris-controlled" : "unconfigured"
  };
}
async function probeCctvSnapshot() {
  const source = process.env.CCTV_SOURCE_URL || "";
  if (!source) return {status:"not_configured",verified:false};
  try {
    const result = await proxyCctvRequest({source});
    if (!result.body) return {status:"failed",verified:false,error:result.error || "cctv_snapshot_probe_failed",httpStatus:result.status};
    if (!result.isImage || !/^image\/(?:jpeg|png|webp)$/i.test(result.contentType || "")) {
      return {status:"not_a_snapshot",verified:false,httpStatus:result.status,contentType:result.contentType || null};
    }
    return {
      status:"verified",
      verified:true,
      contentType:result.contentType,
      byteLength:result.body.length,
      sha256:require("node:crypto").createHash("sha256").update(result.body).digest("hex"),
      checkedAt:new Date().toISOString()
    };
  } catch (error) {
    return {status:"failed",verified:false,error:error instanceof Error ? error.message : String(error)};
  }
}

async function probeOverpassOperation() {
  if (process.env.NODE_ENV === "test") return {status:"skipped-test-runtime",verified:false};
  try {
    const result = await adapters.execute({
      id:"overpass-turbo",
      operation:"query",
      input:{query:"[out:json];node(1);out;"}
    });
    const valid = Boolean(result.ok && result.status >= 200 && result.status < 300 && Array.isArray(result.result?.elements) && result.evidence?.source && result.evidence?.requestId);
    return {
      status:valid ? "verified" : "failed",
      verified:valid,
      httpStatus:result.status || null,
      elementCount:Array.isArray(result.result?.elements) ? result.result.elements.length : null,
      source:result.evidence?.source || null,
      requestId:result.requestId || result.evidence?.requestId || null,
      attempts:result.execution?.attempts || null,
      retries:result.execution?.retries || null,
      ...(valid ? {} : {error:result.error || result.result?.remark || "overpass_operation_contract_failed"})
    };
  } catch (error) {
    return {status:"failed",verified:false,error:error instanceof Error ? error.message : String(error)};
  }
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
  const probeId = require("node:crypto").randomUUID();
  const sessionId = "mindcloud-persistence-probe-" + probeId;
  const marker = "MINDCLOUD_PERSISTENCE_PROBE_V1_" + probeId;
  const datasetName = process.env.COGNEE_MEMORY_DATASET || "mindcloud-selftest";
  const parseResponse = async response => {
    try { return await response.json(); }
    catch { return {raw:await response.text().catch(()=> "")}; }
  };
  const recall = async () => {
    const response = await fetch(endpoint + "/api/v1/recall", {
      method:"POST",
      headers:{"content-type":"application/json","accept":"application/json"},
      body:JSON.stringify({query:marker,session_id:sessionId,scope:["session"],only_context:true,top_k:5}),
      signal:AbortSignal.timeout(20000)
    });
    return {response,body:await parseResponse(response)};
  };
  const containsMarker = body => JSON.stringify(body).includes(marker);
  try {
    // A unique marker/session prevents stale data from masking a failed write.
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
    let readback = null;
    let readbackAttempts = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      readbackAttempts = attempt;
      readback = await recall();
      if (readback.response.ok && containsMarker(readback.body)) break;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 500));
    }
    const persisted = Boolean(readback && readback.response.ok && containsMarker(readback.body));
    return {
      status:persisted ? "healthy" : "degraded",
      persisted,
      mode:"write-readback",
      writeHttpStatus:writeResponse.status,
      readHttpStatus:readback ? readback.response.status : null,
      readbackAttempts,
      sessionId,
      markerHash:require("node:crypto").createHash("sha256").update(marker).digest("hex"),
      ...(persisted ? {} : {detail:readback ? readback.body : null})
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
  const cctvSnapshotProbe = await probeCctvSnapshot();
  cctvSnapshotState = cctvSnapshotProbe;
  const overpassOperationProbe = await probeOverpassOperation();
  const memory = await cogneeHealth();
  const memoryRoundTrip = memory.status === "healthy" ? await cogneeMemoryRoundTrip() : {status:memory.status,persisted:false};
  const browserUse = await adapters.health("browser-use");
  let browserExecutionAttempts = 0;
  let browserExecution = {ok:false,error:"browser_use_not_healthy"};
  if (browserUse.status === "healthy") {
    for (let attempt = 1; attempt <= 2; attempt++) {
      browserExecutionAttempts = attempt;
      browserExecution = await adapters.execute({
        id:"browser-use",
        operation:"browse",
        input:{url:"https://example.com",sessionId:"mindcloud-e2e-selftest-" + taskId,waitUntil:"domcontentloaded",timeout:15000}
      });
      const succeeded = Boolean(browserExecution.ok && browserExecution.result?.status === "executed" && browserExecution.result?.httpStatus >= 200 && browserExecution.result?.httpStatus < 400);
      if (succeeded) break;
      const status = Number(browserExecution.status ?? browserExecution.result?.httpStatus);
      const detail = [browserExecution.error,browserExecution.result?.error,browserExecution.result?.message].filter(Boolean).join(" ");
      const transient = [408,429,500,502,503,504].includes(status) ||
        /target page, context or browser has been closed|browser_execution_failed|temporarily unavailable/i.test(detail);
      if (attempt === 2 || !transient) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
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
    {id:"browser-use-execution",ok:browserExecutionOk,status:browserExecutionOk ? "executed" : browserExecution.error || browserExecution.result?.error || "failed",httpStatus:browserExecution.result?.httpStatus ?? browserExecution.status ?? null,attempts:browserExecutionAttempts}
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
        attempts:browserExecutionAttempts,
        adapterExecution:browserExecution.execution || null,
        httpStatus:browserExecution.result.httpStatus,
        title:browserExecution.result.title,
        url:browserExecution.result.url,
        sessionId:browserExecution.result.sessionId
      } : {
        status:"failed",
        attempts:browserExecutionAttempts,
        error:browserExecution.error || browserExecution.result?.error || "browser_execution_failed",
        message:browserExecution.result?.message || null
      }
    },
    optional:{cctv:cctvResponse(),cctvSnapshotProbe,overpassOperationProbe},
    timestamp:new Date().toISOString()
  };
}
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, "http://"+(req.headers.host||"localhost"));
  const pathname = url.pathname;
  if(pathname==="/trading"||pathname==="/trading/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(tradingHtml);return;}
  if(pathname==="/newsletter"||pathname==="/newsletter/"||pathname==="/briefing"||pathname==="/briefing/"||pathname==="/nyheter"||pathname==="/nyheter/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(newsletterHtml);return;}
  if(pathname==="/health"){sendJson(res,{status:"ok",service:"osiris-mindcloud-ui"});return;}
  if(pathname==="/api/mindcloud/arena/evaluate" && req.method==="POST"){
    try {
      const input = await readJson(req);
      sendJson(res, evaluateArena(input));
    } catch (error) {
      sendJson(res,{error:error instanceof Error ? error.message : String(error)},Number.isInteger(error.statusCode) ? error.statusCode : 400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/arena/run" && req.method==="POST"){
    const expectedToken = process.env.MINDCLOUD_EVIDENCE_WRITE_TOKEN || "";
    if (!expectedToken) { sendJson(res,{error:"mindcloud_evidence_write_token_not_configured"},503); return; }
    if (!tokenMatches(bearerToken(req), expectedToken)) { sendJson(res,{error:"unauthorized"},401); return; }
    try {
      const input = await readJson(req);
      sendJson(res,runArenaWorkflow(input,evidenceGraph),201);
    } catch(error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res,{error:message},Number.isInteger(error.statusCode) ? error.statusCode : 400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/policy/mandates" && req.method==="GET"){
    sendJson(res, listMandates());
    return;
  }
  if(pathname==="/api/mindcloud/policy/evaluate" && req.method==="POST"){
    try {
      const input = await readJson(req);
      sendJson(res, evaluateMandate(input));
    } catch (error) {
      sendJson(res,{error:error instanceof Error ? error.message : String(error)},Number.isInteger(error.statusCode) ? error.statusCode : 400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/decision-governor/evaluate" && req.method==="POST"){
    try {
      const input = await readJson(req);
      sendJson(res, evaluateDecision(input));
    } catch (error) {
      sendJson(res,{error:error instanceof Error ? error.message : String(error)},Number.isInteger(error.statusCode) ? error.statusCode : 400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/metanoia/evaluate" && req.method==="POST"){
    try {
      const input = await readJson(req);
      const report = evaluateMetanoia(input);
      rememberMetanoiaReport(report);
      sendJson(res, report);
    } catch (error) {
      sendJson(res,{error:error instanceof Error ? error.message : String(error)},Number.isInteger(error.statusCode) ? error.statusCode : 400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/metanoia/approve" && req.method==="POST"){
    if (!isApprovalAuthorized(req)) { sendJson(res,{error:"approval_authorization_required"},401); return; }
    try {
      const input = await readJson(req);
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        sendJson(res,{error:"invalid_metanoia_approval"},400); return;
      }
      if (typeof input.reportHash !== "string" || !/^[a-f0-9]{64}$/.test(input.reportHash) ||
          typeof input.expectedPreviousVersionId !== "string" || !input.expectedPreviousVersionId) {
        sendJson(res,{error:"report_hash_and_expected_previous_version_required"},400); return;
      }
      const reportEntry = metanoiaReports.get(input.reportHash);
      if (!reportEntry || reportEntry.consumed || Date.now() > reportEntry.expiresAt) {
        sendJson(res,{error:"metanoia_report_missing_expired_or_consumed"},409); return;
      }
      const report = reportEntry.report;
      if (report.reportHash !== input.reportHash || report.status !== "review_required" ||
          (!report.findings?.contradictions?.length && !report.findings?.anomalies?.length)) {
        sendJson(res,{error:"metanoia_report_not_eligible_for_approval"},409); return;
      }
      const versions = mindcloud.versionHistory.list();
      const previousVersion = versions[versions.length - 1];
      if (!previousVersion || input.expectedPreviousVersionId !== previousVersion.id) {
        sendJson(res,{error:"metanoia_previous_version_conflict",expectedPreviousVersionId:previousVersion?.id || null},409); return;
      }
      if (!input.proposedModel || typeof input.proposedModel !== "object" || Array.isArray(input.proposedModel)) {
        sendJson(res,{error:"proposed_model_object_required"},400); return;
      }
      if (typeof input.rationale !== "string" || input.rationale.trim().length < 8) {
        sendJson(res,{error:"rationale_required_min_8_chars"},400); return;
      }
      const findingEvidenceRefs = (report.findings?.contradictions || []).flatMap(item => item.evidenceRefs || []);
      const permittedEvidenceRefs = new Set([...(report.evidenceRefs || []), ...findingEvidenceRefs]);
      if (!Array.isArray(input.evidenceRefs) ||
          input.evidenceRefs.some(ref => typeof ref !== "string" || !permittedEvidenceRefs.has(ref))) {
        sendJson(res,{error:"metanoia_evidence_refs_not_in_review"},400); return;
      }
      if (!mindcloud.versionHistory.storePath) {
        sendJson(res,{error:"model_version_store_not_configured"},503); return;
      }
      const newVersion = mindcloud.createModelVersion({
        model:input.proposedModel,
        rationale:input.rationale.trim(),
        changeType:"metanoia-revalidation",
        evidenceRefs:input.evidenceRefs
      });
      reportEntry.consumed = true;
      sendJson(res,{
        type:"mindcloud_metanoia_version_transition",
        reportHash:report.reportHash,
        previousVersion:mindcloud.versionHistory.get(previousVersion.id),
        newVersion
      },201);
    } catch(error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res,{error:message},Number.isInteger(error.statusCode) ? error.statusCode : 400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/evidence-graph" && req.method==="GET"){
    const expectedToken = process.env.MINDCLOUD_EVIDENCE_READ_TOKEN || "";
    if (!expectedToken) { sendJson(res,{error:"mindcloud_evidence_read_token_not_configured"},503); return; }
    if (!tokenMatches(bearerToken(req), expectedToken)) { sendJson(res,{error:"unauthorized"},401); return; }
    sendJson(res,evidenceGraph.snapshot());
    return;
  }
  if((pathname==="/api/mindcloud/evidence-graph/nodes" || pathname==="/api/mindcloud/evidence-graph/edges") && req.method==="POST"){
    const expectedToken = process.env.MINDCLOUD_EVIDENCE_WRITE_TOKEN || "";
    if (!expectedToken) { sendJson(res,{error:"mindcloud_evidence_write_token_not_configured"},503); return; }
    if (!tokenMatches(bearerToken(req), expectedToken)) { sendJson(res,{error:"unauthorized"},401); return; }
    try {
      const input = await readJson(req);
      if (pathname.endsWith("/nodes")) sendJson(res,{type:"mindcloud_evidence_node_created",node:evidenceGraph.addNode(input)},201);
      else sendJson(res,{type:"mindcloud_evidence_edge_created",edge:evidenceGraph.addEdge(input)},201);
    } catch(error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res,{error:message},Number.isInteger(error.statusCode) ? error.statusCode : 500);
    }
    return;
  }
  if(pathname==="/api/mindcloud/status"){sendJson(res,mindcloud.snapshot());return;}
  if(pathname==="/api/mindcloud/versions" && req.method==="GET"){
    sendJson(res,{type:"mindcloud_model_version_history",versions:mindcloud.versionHistory.list()});
    return;
  }
  if(pathname==="/api/mindcloud/versions" && req.method==="POST"){
    const expectedToken = process.env.MINDCLOUD_MODEL_VERSION_WRITE_TOKEN || "";
    if (!expectedToken) { sendJson(res,{error:"model_version_write_token_not_configured"},503); return; }
    if (!tokenMatches(bearerToken(req), expectedToken)) { sendJson(res,{error:"unauthorized"},401); return; }
    try {
      const input = await readJson(req);
      const version = mindcloud.createModelVersion(input);
      sendJson(res,{type:"mindcloud_model_version_created",version},201);
    } catch(error) {
      const status = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      sendJson(res,{error:error instanceof Error ? error.message : String(error)},status);
    }
    return;
  }
  if(pathname.startsWith("/api/mindcloud/versions/") && req.method==="GET"){
    const id = decodeURIComponent(pathname.slice("/api/mindcloud/versions/".length));
    const version = mindcloud.versionHistory.get(id);
    if(!version){sendJson(res,{error:"model_version_not_found"},404);return;}
    sendJson(res,{type:"mindcloud_model_version",version});
    return;
  }
  if(pathname==="/api/mindcloud/selftest" && req.method==="POST"){
    try { sendJson(res,await runMindcloudSelfTest()); }
    catch (error) { sendJson(res,{type:"mindcloud_e2e_selftest",status:"failed",error:error instanceof Error ? error.message : String(error)},500); }
    return;
  }
  if(pathname==="/api/mindcloud/capabilities"){sendJson(res,{type:"mindcloud_capability_graph",layers:mindcloud.snapshot().capabilityLayers,recipes:mindcloud.snapshot().recipes});return;}
  if(pathname==="/api/mindcloud/suggest"){const task={kind:url.searchParams.get("kind")||"general",goal:url.searchParams.get("goal")||""};sendJson(res,{type:"mindcloud_suggestion",...require("./mindcloud/capability-graph").suggest(task)});return;}
  if(pathname==="/api/mindcloud/route" && req.method==="POST"){
    const expectedToken = process.env.MINDCLOUD_TASK_WRITE_TOKEN || "";
    if (!expectedToken) { sendJson(res,{error:"mindcloud_task_write_token_not_configured"},503); return; }
    if (!tokenMatches(bearerToken(req), expectedToken)) { sendJson(res,{error:"unauthorized"},401); return; }
    try {
      const task = await readJson(req);
      if (!task || typeof task !== "object" || Array.isArray(task)) return sendJson(res,{error:"invalid_task"},400);
      if (!task.taskId) task.taskId = "task-" + Date.now();
      sendJson(res,mindcloud.route(task));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res,{error:message},message.includes("store") ? 500 : 400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/events"){sendJson(res,{type:"mindcloud_events",events:mindcloud.eventsFor(url.searchParams.get("taskId")||undefined)});return;}
  if(pathname==="/api/router"){const kind=url.searchParams.get("kind")||"general";sendJson(res,{network:routerNetwork.snapshot(),route:routerNetwork.route({taskId:"ui-route",kind})});return;}
  if(pathname==="/api/mindcloud/providers" && req.method==="GET") {
    sendJson(res,{type:"mindcloud_provider_catalog",providers:providerNetwork.catalog(),executionConfigured:Boolean(process.env.MINDCLOUD_TOOL_EXECUTION_TOKEN)});
    return;
  }
  if(pathname==="/api/mindcloud/providers/collaborate" && req.method==="POST") {
    if (!isExecutionAuthorized(req)) { sendJson(res,{error:"unauthorized"},401); return; }
    try {
      const request = await readJson(req);
      const collaboration = await providerNetwork.collaborate({
        goal: request?.goal,
        providerIds: request?.providerIds,
        rounds: request?.rounds,
        tokenBudget: request?.tokenBudget,
        maxTokensPerCall: request?.maxTokensPerCall
      });
      sendJson(res,collaboration);
    } catch(error) {
      sendJson(res,{error:error?.code || "provider_collaboration_failed",message:error instanceof Error?error.message:String(error)},400);
    }
    return;
  }
  if(pathname==="/api/mindcloud/agent-cluster/plan" && req.method==="POST") {
    if (!isExecutionAuthorized(req)) { sendJson(res,{error:"unauthorized"},401); return; }
    try {
      const request = await readJson(req);
      const plan = agentCluster.plan({
        goal: request?.goal,
        depth: request?.depth,
        requestedAgents: request?.requestedAgents,
        tokenBudget: request?.tokenBudget,
        constraints: request?.constraints
      });
      sendJson(res,plan);
    } catch(error) {
      const code = error?.code === "agent_cluster_goal_required" ? 400 : 400;
      sendJson(res,{error:error?.code || "agent_cluster_plan_failed",message:error instanceof Error?error.message:String(error)},code);
    }
    return;
  }
  if(pathname==="/api/agent-tools"){sendJson(res,agentTools);return;}
  if(pathname==="/api/adapters"){sendJson(res,adapters.snapshot());return;}
  if(pathname.startsWith("/api/adapters/") && pathname.endsWith("/discover")){const id=pathname.split("/")[3];sendJson(res,adapters.discover(id));return;}
  if(pathname.startsWith("/api/adapters/") && pathname.endsWith("/health")){const id=pathname.split("/")[3];adapters.health(id).then(result=>{adapters.record(require("node:crypto").randomUUID(),{id,operation:"health",ok:Boolean(result?.ok),result});sendJson(res,result);});return;}
  if(pathname==="/api/approvals" && req.method==="GET") {
    if (!isExecutionAuthorized(req)) { sendJson(res,{error:"unauthorized"},401); return; }
    sendJson(res,{type:"mindcloud_approval_queue",requests:[...approvalRequests.values()],audit:approvalAudit});
    return;
  }
  if(pathname==="/api/approvals/request" && req.method==="POST") {
    if (!isExecutionAuthorized(req)) { sendJson(res,{error:"unauthorized"},401); return; }
    try {
      const task=await readJson(req);
      const tool=agentTools.tools.find(item=>item.id===task?.id);
      if (!tool || !tool.operations?.includes(task.operation)) { sendJson(res,{error:"operation_not_allowed"},400); return; }
      if (!tool.security) { sendJson(res,{error:"approval_not_required"},400); return; }
      sendJson(res,{type:"mindcloud_approval_request",request:createApprovalRequest(tool,task.operation,task.input)},201);
    } catch(error) { sendJson(res,{error:error instanceof Error?error.message:String(error)},400); }
    return;
  }
  if(pathname.startsWith("/api/approvals/") && pathname.endsWith("/decision") && req.method==="POST") {
    if (!isApprovalAuthorized(req)) { sendJson(res,{error:"approval_authorization_required"},401); return; }
    const id=pathname.split("/")[3];
    try {
      const body=await readJson(req);
      const result=decideApproval(id,body?.decision,body?.reason);
      if (result.error) { sendJson(res,result,result.error==="approval_not_found"?404:409); return; }
      sendJson(res,{type:"mindcloud_approval_decision",request:result});
    } catch(error) { sendJson(res,{error:error instanceof Error?error.message:String(error)},400); }
    return;
  }
  // Both public entry points share the same authenticated adapter runtime, approval gate, audit, and evidence capture.
  if((pathname==="/api/adapters/execute" || pathname==="/api/mindcloud/dispatch") && req.method==="POST"){
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
      // Client-provided approval is never trusted. Passive subdomain lookups are allowed
      // only when the requested root is covered by the server-owned domain allowlist.
      const passiveScopeApproved = tool.id === "subdomain-finder" && isAuthorizedSubdomainScope(task.input?.domain);
      const ticketApproved = Boolean(tool.security && consumeApproval(task.approvalId,tool.id,task.operation,task.input));
      const approved = !tool.security || passiveScopeApproved || ticketApproved;
      const execution = await adapters.execute({...task,approved});
      if (execution.ok && execution.evidence && typeof execution.evidence === "object") {
        const capturedAt = new Date().toISOString();
        const source = typeof execution.evidence.source === "string" && execution.evidence.source.trim()
          ? execution.evidence.source.trim()
          : `adapter://${task.id}/${task.operation}`;
        const sha256 = value => require("node:crypto").createHash("sha256").update(value).digest("hex");
        try {
          const node = evidenceGraph.addNode({
            type:"tool-observation",
            label:`${task.id} ${task.operation} observation`,
            sourceRef:source,
            content:{
              schemaVersion:1,
              kind:"adapter-observation",
              validationStatus:"unvalidated",
              toolId:task.id,
              operation:task.operation,
              requestId:execution.evidence.requestId || null,
              source,
              retrievedAt:execution.evidence.retrievedAt || capturedAt,
              capturedAt,
              inputHash:sha256(JSON.stringify(task.input ?? {})),
              resultHash:sha256(JSON.stringify(execution.result ?? null)),
              provider:execution.evidence.provider || null,
              provenance:execution.evidence,
              validation:{status:"unvalidated",reason:"Adapter output is an observation, not a verified claim."}
            }
          });
          execution.evidenceGraph = {
            status:evidenceGraph.storePath ? "persisted" : "in-memory",
            nodeId:node.id,
            contentHash:node.contentHash,
            validationStatus:"unvalidated"
          };
        } catch {
          execution.evidenceGraph = {status:"write-failed",error:"evidence_graph_write_failed",validationStatus:"unlinked"};
        }
      }
      sendJson(res,execution);
    } catch(error) {
      sendJson(res,{ok:false,error:error instanceof Error?error.message:String(error)},400);
    }
    return;
  }
  if(pathname==="/api/capabilities"){sendJson(res,{type:"mindcloud_capability_registry",source:"MindCore",capabilities:routerNetwork.geospatialCapabilities.list()});return;}
  if(pathname==="/api/liveness/route"){sendJson(res,{type:"mindcloud_live_liveness",capability:"route-variation",status:"available",policy:"safety-first-accessibility-second-controlled-variation",humanApprovalRequired:true});return;}
  if(pathname==="/api/cctv/stream" && req.method==="GET"){
    const expectedToken = process.env.CCTV_PROXY_TOKEN || "";
    const suppliedToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!expectedToken) { sendJson(res,{error:"cctv_proxy_token_not_configured"},503); return; }
    if (!suppliedToken || suppliedToken.length !== expectedToken.length ||
        !require("node:crypto").timingSafeEqual(Buffer.from(suppliedToken), Buffer.from(expectedToken))) {
      sendJson(res,{error:"unauthorized"},401); return;
    }
    let resource = null;
    const encodedResource = url.searchParams.get("resource");
    if (encodedResource) {
      try {
        if (encodedResource.length > 8192) throw new Error("resource_too_long");
        resource = Buffer.from(encodedResource, "base64url").toString("utf8");
        if (!resource || !/^https?:\/\//i.test(resource)) throw new Error("invalid_resource");
      } catch {
        sendJson(res,{error:"cctv_resource_invalid_encoding"},400); return;
      }
    }
    const result = await proxyCctvRequest({source:process.env.CCTV_SOURCE_URL || "",resource});
    if (!result.body) {
      sendJson(res,{error:result.error || "cctv_proxy_failed",...(result.upstreamStatus ? {upstreamStatus:result.upstreamStatus} : {}),...(result.contentType ? {contentType:result.contentType} : {})},result.status);
      return;
    }
    res.writeHead(result.status, {
      "content-type":result.contentType,
      "cache-control":"no-store",
      "x-content-type-options":"nosniff",
      "content-security-policy":"default-src 'none'"
    });
    res.end(result.body);
    return;
  }
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
