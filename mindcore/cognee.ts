import type {AgentCapability,TaskContext} from "./contracts";
import {requireApproval} from "./approval-gate";

export type CogneeOperation = "remember" | "recall" | "improve" | "forget";

export interface CogneeRequest {
  operation: CogneeOperation;
  content?: string;
  query?: string;
  dataset?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface CogneeAdapter {
  id: "cognee";
  endpoint: string;
  health(): Promise<{status:"healthy"|"degraded"|"offline"|"unknown";checkedAt:string;message?:string}>;
  execute(request:CogneeRequest): Promise<unknown>;
}

/**
 * HTTP adapter for a self-hosted Cognee API.
 * Uses Cognee's primary memory routes:
 *   /api/v1/remember, /api/v1/recall, /api/v1/improve, /api/v1/forget
 */
export class HttpCogneeAdapter implements CogneeAdapter {
  readonly id="cognee" as const;
  constructor(
    public readonly endpoint:string,
    private readonly fetchImpl:typeof fetch=fetch,
  ) {}

  private url(path:string){return this.endpoint.replace(/\/$/,"")+path;}
  private async request(path:string,init:RequestInit={}){
    const response=await this.fetchImpl(this.url(path),{
      ...init,
      headers:{"content-type":"application/json",...(init.headers||{})},
    });
    const text=await response.text();
    let body:unknown;
    try{body=text?JSON.parse(text):null;}catch{body=text;}
    if(!response.ok) throw new Error(`Cognee API ${response.status}: ${typeof body==="string"?body:JSON.stringify(body)}`);
    return body;
  }

  async health(){
    const checkedAt=new Date().toISOString();
    try{
      const r=await this.fetchImpl(this.url("/health"));
      return {status:r.ok?"healthy":"degraded",checkedAt,message:r.ok?undefined:`HTTP ${r.status}`} as const;
    }catch(error){
      return {status:"offline",checkedAt,message:error instanceof Error?error.message:String(error)} as const;
    }
  }

  async execute(request:CogneeRequest){
    const dataset=request.dataset||"mindcloud";
    switch(request.operation){
      case "remember":{
        if(!request.content) throw new Error("Cognee remember requires content");
        const form=new FormData();
        form.append("data",new Blob([request.content],{type:"text/plain"}),"memory.txt");
        form.append("datasetName",dataset);
        if(request.sessionId) form.append("sessionId",request.sessionId);
        return this.request("/api/v1/remember",{method:"POST",body:form,headers:{}});
      }
      case "recall":
        if(!request.query) throw new Error("Cognee recall requires query");
        return this.request("/api/v1/recall",{method:"POST",body:JSON.stringify({
          query:request.query,datasets:[dataset],session_id:request.sessionId
        })});
      case "improve":
        return this.request("/api/v1/improve",{method:"POST",body:JSON.stringify({
          dataset_name:dataset,session_ids:request.sessionId?[request.sessionId]:undefined
        })});
      case "forget":
        return this.request("/api/v1/forget",{method:"POST",body:JSON.stringify({
          dataset,everything:false,memory_only:false
        })});
    }
  }
}

export function cogneeMemoryCapability(adapter:CogneeAdapter):AgentCapability {
  return {
    id:"cognee-memory",
    layer:"Knowledge",
    status:"available",
    approval:"admin",
    invoke:async(input:unknown,context:TaskContext)=>{
      requireApproval(context,"admin");
      const request=input as CogneeRequest;
      context.audit({
        taskId:context.taskId,type:"tool-call",timestamp:new Date().toISOString(),source:"cognee",
        data:{operation:request.operation,dataset:request.dataset,sessionId:request.sessionId}
      });
      const result=await adapter.execute(request);
      context.audit({
        taskId:context.taskId,type:"tool-result",timestamp:new Date().toISOString(),source:"cognee",
        data:{operation:request.operation}
      });
      return result;
    }
  };
}
