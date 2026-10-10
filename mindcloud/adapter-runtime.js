const crypto = require("node:crypto");
const native = require("./native-adapters");

class AdapterRuntime {
  constructor(registry) { this.registry = registry; this.audit = []; }

  list() {
    return this.registry.tools.map(tool => ({id:tool.id,layer:tool.layer,status:tool.status,runtime:this.runtimeState(tool)}));
  }

  endpointFor(id) {
    const envName = `ADAPTER_${String(id).toUpperCase().replace(/[^A-Z0-9]/g,"_")}_URL`;
    const aliases = {
      "browser-use":["BROWSER_USE_SERVICE_URL","RAILWAY_SERVICE_BROWSER_USE_RUNNER_URL"],
      "cognee-memory":["COGNEE_SERVICE_URL"], "overpass-turbo":["OVERPASS_API_URL"],
      "geohints":["GEOHINTS_URL"], "google-street-view":["GOOGLE_STREET_VIEW_URL"],
      "shodan":["SHODAN_API_BASE_URL"], "subdomain-finder":["SUBDOMAIN_FINDER_URL"],
      "opensanctions":["OPENSANCTIONS_API_BASE_URL"], "cookies-viewer":["COOKIES_VIEWER_URL"]
    };
    return (process.env[envName] || (aliases[id]||[]).map(k=>process.env[k]).find(Boolean) || "").replace(/\/$/,"");
  }

  runtimeState(tool) {
    const nativeState = native.state(tool.id);
    const endpoint = nativeState || tool.status === "research-registered" ? null : this.endpointFor(tool.id);
    const envName = `ADAPTER_${String(tool.id).toUpperCase().replace(/[^A-Z0-9]/g,"_")}_URL`;
    const endpointAliases = {
      "browser-use":"BROWSER_USE_SERVICE_URL",
      "cognee-memory":"COGNEE_SERVICE_URL",
      "geohints":"GEOHINTS_URL",
      "cookies-viewer":"COOKIES_VIEWER_URL"
    };
    const missingConfiguration = [];
    if (!nativeState && !endpoint) missingConfiguration.push(endpointAliases[tool.id] || envName);
    if (tool.id === "browser-use" && !process.env.BROWSER_USE_API_KEY) missingConfiguration.push("BROWSER_USE_API_KEY");
    const configured = nativeState ? nativeState.configured : missingConfiguration.length === 0;
    const nativeOperations = native.supports(tool.id) ? native.operationsFor(tool.id) : null;
    const operations = nativeOperations
      ? [...nativeOperations, ...((tool.operations||[]).includes("health") ? ["health"] : [])]
      : (tool.operations||[]);
    const executableOperations = operations.filter(operation => operation === "health" || configured);
    const latestHealth = [...this.audit].reverse().find(entry => entry.id === tool.id && entry.operation === "health");
    const latestSuccessfulExecution = [...this.audit].reverse().find(entry =>
      entry.id === tool.id && entry.operation !== "health" && entry.ok === true
    );
    // A successful operation proves the adapter path worked at least once in this
    // runtime session. Otherwise, preserve degraded health instead of mislabeling it
    // as merely configured. Missing configuration remains registered-only.
    // Readiness describes the latest observed state; verification is historical
    // evidence that an execution succeeded at least once in this runtime session.
    // A newer failed health probe must therefore override the readiness label.
    const readiness = latestHealth && (!latestHealth.ok || latestHealth.result?.status !== "healthy") ? "degraded"
      : latestSuccessfulExecution ? "verified"
      : latestHealth && latestHealth.ok && latestHealth.result?.status === "healthy" ? "healthy"
      : configured ? "configured" : "registered-only";
    return {
      state:configured?"configured":"registered-only",
      readiness,
      healthStatus:latestHealth?.result?.status || "not-checked",
      verification: latestSuccessfulExecution ? {
        status:"verified",
        lastVerifiedAt:latestSuccessfulExecution.timestamp,
        operation:latestSuccessfulExecution.operation,
        requestId:latestSuccessfulExecution.requestId
      } : {status:"not-verified"},
      executable:configured,
      transport:nativeState?(nativeState.mode||"native-http"):(tool.transport||"external-runtime"),
      operations,
      executableOperations,
      ...(missingConfiguration.length?{missingConfiguration}:{}),
      ...(nativeState?.required?{required:nativeState.required}:{})
    };
  }

  discover(id) {
    const tool=this.registry.tools.find(item=>item.id===id);
    if(!tool)return {ok:false,error:"adapter_not_found",id};
    const runtime=this.runtimeState(tool);
    return {ok:true,adapter:{id:tool.id,layer:tool.layer,operations:runtime.operations,runtime}};
  }

  async health(id) {
    const tool=this.registry.tools.find(item=>item.id===id);
    if(!tool)return {ok:false,error:"adapter_not_found",id};
    if(tool.status==="research-registered") return {ok:false,status:"research-registered",reason:"capability_not_promoted",executionEnabled:false};
    const nativeHealth=await native.health(id);
    if(nativeHealth)return nativeHealth;
    const endpoint=this.endpointFor(id);
    const missingConfiguration = [];
    if(!endpoint) missingConfiguration.push(id==="browser-use"?"BROWSER_USE_SERVICE_URL":`ADAPTER_${String(id).toUpperCase().replace(/[^A-Z0-9]/g,"_")}_URL`);
    if(id==="browser-use"&&!process.env.BROWSER_USE_API_KEY) missingConfiguration.push("BROWSER_USE_API_KEY");
    if(missingConfiguration.length) {
      const credentialsMissing = Boolean(endpoint) && id==="browser-use" && !process.env.BROWSER_USE_API_KEY;
      return {ok:false,status:credentialsMissing?"credentials-missing":"registered-only",endpoint:endpoint||null,missingConfiguration};
    }
    try {
      const response=await fetch(endpoint+"/health",{signal:AbortSignal.timeout(2500)});
      let details={}; try{details=await response.json();}catch{}
      const browserReady=id!=="browser-use"||details.browserEngine==="browserless-chromium";
      const healthy=response.ok&&browserReady;
      return {ok:healthy,status:healthy?"healthy":"degraded",httpStatus:response.status,endpoint,...(id==="browser-use"?{browserEngine:details.browserEngine||"unknown",persistentSessions:details.persistentSessions===true}:{})};
    } catch(error) { return {ok:false,status:"offline",endpoint,error:error instanceof Error?error.message:String(error)}; }
  }

  async execute({id,operation,input={},approved=false}) {
    const requestId=crypto.randomUUID();
    const tool=this.registry.tools.find(item=>item.id===id);
    if(!tool)return this.record(requestId,{ok:false,error:"adapter_not_found",id,operation});
    if(tool.status==="research-registered" && operation!=="health") return this.record(requestId,{ok:false,error:"capability_not_promoted",id,operation,status:tool.status,executionEnabled:false});
    const runtimeOperations=this.runtimeState(tool).operations;
    if(!tool.operations?.includes(operation))return this.record(requestId,{ok:false,error:"operation_not_allowed",id,operation});
    if(!runtimeOperations.includes(operation))return this.record(requestId,{ok:false,error:"operation_not_implemented",id,operation,implementedOperations:runtimeOperations});
    const inputContract = require("./adapter-contracts").validateAdapterInput(id,operation,input);
    if(!inputContract.ok)return this.record(requestId,{ok:false,id,operation,error:inputContract.error,details:inputContract.details,contract:{version:"1.0",inputValidation:"rejected"}});
    if(operation==="health") {
      const result=await this.health(id);
      return this.record(requestId,{ok:Boolean(result?.ok),id,operation,result,execution:{contractVersion:"1.0",inputContractVersion:inputContract.version,inputValidation:inputContract.mode,attempts:1,retries:0,retryPolicy:"health-probe",recovered:false}});
    }
    if(tool.security&&!approved)return this.record(requestId,{ok:false,error:"human_approval_required",id,operation});
    if(native.supports(id)) {
      try {
        const run = await require("./adapter-policy").executeWithRetry(operation, () => native.execute({id,operation,input,requestId}));
        return this.record(requestId,{id,operation,...(run.value || {ok:false,error:"adapter_execution_failed"}),execution:{...run.execution,inputContractVersion:inputContract.version,inputValidation:inputContract.mode}});
      } catch {
        return this.record(requestId,{ok:false,error:"adapter_execution_failed",id,operation,execution:{contractVersion:"1.0",inputContractVersion:inputContract.version,inputValidation:inputContract.mode,attempts:"unknown",retryPolicy:"adapter-policy"}});
      }
    }
    const endpoint=this.endpointFor(id);
    if(!endpoint)return this.record(requestId,{ok:false,error:"adapter_not_configured",id,operation});
    const isBrowserUse=id==="browser-use", token=process.env.BROWSER_USE_API_KEY||"";
    if(isBrowserUse&&!token)return this.record(requestId,{ok:false,error:"adapter_credentials_missing",id,operation});
    const headers={"content-type":"application/json"};
    if(isBrowserUse)headers.authorization="Bearer "+token;
    try {
      const run = await require("./adapter-policy").executeWithRetry(operation, async () => {
        const response=await fetch(endpoint+(isBrowserUse?"/v1/run":"/execute"),{method:"POST",headers,body:JSON.stringify({requestId,operation,input}),signal:AbortSignal.timeout(30000)});
        const contentType=response.headers.get("content-type")||"";
        let result;
        if(contentType.includes("application/json")){const text=await response.text();try{result=JSON.parse(text);}catch{result={raw:text};}}
        else if(contentType.startsWith("image/"))result={contentType,base64:Buffer.from(await response.arrayBuffer()).toString("base64")};
        else result={contentType,raw:await response.text()};
        return {ok:response.ok,id,operation,status:response.status,result};
      });
      return this.record(requestId,{id,operation,...(run.value || {ok:false,error:"adapter_execution_failed"}),execution:{...run.execution,inputContractVersion:inputContract.version,inputValidation:inputContract.mode}});
    } catch {
      return this.record(requestId,{ok:false,error:"adapter_execution_failed",id,operation,execution:{contractVersion:"1.0",inputContractVersion:inputContract.version,inputValidation:inputContract.mode,attempts:"unknown",retryPolicy:"adapter-policy"}});
    }
  }

  record(requestId,result){const entry={...result,requestId,timestamp:new Date().toISOString()};this.audit.push(entry);return {...result,requestId};}
  snapshot(){
    const adapters=this.list();
    const readinessSummary={
      total:adapters.length,
      registeredOnly:adapters.filter(adapter=>adapter.runtime.readiness==="registered-only").length,
      configured:adapters.filter(adapter=>adapter.runtime.readiness==="configured").length,
      healthy:adapters.filter(adapter=>adapter.runtime.readiness==="healthy").length,
      verified:adapters.filter(adapter=>adapter.runtime.readiness==="verified").length,
      degraded:adapters.filter(adapter=>adapter.runtime.readiness==="degraded").length,
      healthNotChecked:adapters.filter(adapter=>adapter.runtime.healthStatus==="not-checked").length,
      executionNotVerified:adapters.filter(adapter=>adapter.runtime.verification.status!=="verified").length
    };
    return {
      type:"mindcloud_adapter_runtime",
      contractVersion:"1.0",
      verificationScope:"current-runtime-session",
      lifecycle:["discover","health","execute","result","audit"],
      readinessSummary,
      adapters,
      auditCount:this.audit.length
    };
  }
}
module.exports={AdapterRuntime};
