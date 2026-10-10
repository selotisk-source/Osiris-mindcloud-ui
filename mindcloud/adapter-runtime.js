const crypto = require("node:crypto");

class AdapterRuntime {
  constructor(registry) {
    this.registry = registry;
    this.audit = [];
  }

  list() {
    return this.registry.tools.map(tool => ({
      id: tool.id,
      layer: tool.layer,
      status: tool.status,
      runtime: this.runtimeState(tool)
    }));
  }

  runtimeState(tool) {
    const configured = Boolean(process.env[`ADAPTER_${String(tool.id).toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`]);
    return {
      state: configured ? "configured" : "registered-only",
      executable: configured,
      transport: tool.transport || "external-runtime",
      operations: tool.operations || []
    };
  }

  discover(id) {
    const tool = this.registry.tools.find(item => item.id === id);
    if (!tool) return {ok:false,error:"adapter_not_found",id};
    return {ok:true,adapter:{id:tool.id,layer:tool.layer,operations:tool.operations || [],runtime:this.runtimeState(tool)}};
  }

  async health(id) {
    const tool = this.registry.tools.find(item => item.id === id);
    if (!tool) return {ok:false,error:"adapter_not_found",id};
    const envName = `ADAPTER_${String(id).toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`;
    const endpoint = (process.env[envName] || "").replace(/\/$/, "");
    if (!endpoint) return {ok:true,status:"registered-only",endpoint:null};
    try {
      const response = await fetch(endpoint + "/health", {signal:AbortSignal.timeout(2500)});
      return {ok:response.ok,status:response.ok ? "healthy" : "degraded",httpStatus:response.status,endpoint};
    } catch (error) {
      return {ok:false,status:"offline",endpoint,error:error instanceof Error ? error.message : String(error)};
    }
  }

  async execute({id,operation,input={},approved=false}) {
    const requestId = crypto.randomUUID();
    const tool = this.registry.tools.find(item => item.id === id);
    if (!tool) return this.record(requestId,{ok:false,error:"adapter_not_found",id,operation});
    if (!tool.operations?.includes(operation)) return this.record(requestId,{ok:false,error:"operation_not_allowed",id,operation});
    if (tool.security && !approved) return this.record(requestId,{ok:false,error:"human_approval_required",id,operation});
    const envName = `ADAPTER_${String(id).toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`;
    const endpoint = (process.env[envName] || "").replace(/\/$/, "");
    if (!endpoint) return this.record(requestId,{ok:false,error:"adapter_not_configured",id,operation});
    try {
      const response = await fetch(endpoint + "/execute", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({requestId,operation,input}),
        signal:AbortSignal.timeout(15000)
      });
      const text = await response.text();
      let result; try { result = JSON.parse(text); } catch { result = {raw:text}; }
      return this.record(requestId,{ok:response.ok,id,operation,status:response.status,result});
    } catch (error) {
      return this.record(requestId,{ok:false,id,operation,error:error instanceof Error ? error.message : String(error)});
    }
  }

  record(requestId,result) {
    this.audit.push({requestId,timestamp:new Date().toISOString(),...result});
    return result;
  }

  snapshot() {
    return {type:"mindcloud_adapter_runtime",lifecycle:["discover","health","execute","result","audit"],adapters:this.list(),auditCount:this.audit.length};
  }
}

module.exports = {AdapterRuntime};
