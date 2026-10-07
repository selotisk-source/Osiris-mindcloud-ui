import type {AgentCapability,ApprovalLevel,TaskContext} from "./contracts";
import {requireApproval} from "./approval-gate";

export type AgentToolId = "graft" | "openmontage" | "codebase-memory-mcp";

export interface ToolExecutionRequest {
  tool:AgentToolId;
  operation:string;
  args?:string[];
  input?:unknown;
  cwd?:string;
  env?:Record<string,string>;
}

export interface ToolExecutionResult {
  ok:boolean;
  exitCode?:number|null;
  stdout?:string;
  stderr?:string;
  data?:unknown;
}

export interface ToolExecutor {
  execute(request:ToolExecutionRequest):Promise<ToolExecutionResult>;
  health(tool:AgentToolId):Promise<{status:"healthy"|"degraded"|"offline"|"unknown";checkedAt:string;message?:string}>;
}

type ToolSpec={
  id:AgentToolId;
  name:string;
  layer:string;
  source:string;
  operations:string[];
  approval:ApprovalLevel;
  description:string;
};

export const agentToolSpecs:ToolSpec[]=[
  {
    id:"graft",
    name:"Graft",
    layer:"CodeIntelligence",
    source:"NanoNets/Graft",
    operations:["init","build","ask","grep","map","viz"],
    approval:"admin",
    description:"Persistent codebase context graph for coding agents; generated graph stays a local regenerable cache."
  },
  {
    id:"openmontage",
    name:"OpenMontage",
    layer:"MediaPipeline",
    source:"calesthio/OpenMontage",
    operations:["plan","research","script","render","validate"],
    approval:"admin",
    description:"Agentic video-production pipeline exposed as a supervised workspace capability."
  },
  {
    id:"codebase-memory-mcp",
    name:"Codebase Memory MCP",
    layer:"CodeIntelligence",
    source:"DeusData/codebase-memory-mcp",
    operations:["search_graph","trace_path","architecture","impact_analysis","list_projects","index_repository"],
    approval:"admin",
    description:"Local MCP code-intelligence graph for structural queries, call chains and repository indexing."
  }
];

function spec(id:AgentToolId){return agentToolSpecs.find(x=>x.id===id)!;}

export function createAgentToolCapabilities(executor:ToolExecutor):AgentCapability[]{
  return agentToolSpecs.map(s=>({
    id:s.id,
    layer:s.layer,
    status:"available",
    approval:s.approval,
    invoke:async(input:unknown,context:TaskContext)=>{
      requireApproval(context,s.approval);
      const payload=(input&&typeof input==="object"?input:{}) as Record<string,unknown>;
      const operation=String(payload.operation||"");
      if(!s.operations.includes(operation)) throw new Error(`Unsupported ${s.id} operation: ${operation}`);
      const args=Array.isArray(payload.args)?payload.args.map(String):[];
      context.audit({
        taskId:context.taskId,
        type:"tool-call",
        timestamp:new Date().toISOString(),
        source:s.id,
        data:{operation,args}
      });
      const result=await executor.execute({
        tool:s.id,
        operation,
        args,
        input:payload.input,
        cwd:typeof payload.cwd==="string"?payload.cwd:undefined
      });
      context.audit({
        taskId:context.taskId,
        type:result.ok?"tool-result":"error",
        timestamp:new Date().toISOString(),
        source:s.id,
        data:{operation,exitCode:result.exitCode??null}
      });
      if(!result.ok) throw new Error(result.stderr||`${s.id} failed`);
      return result;
    }
  }));
}

export function toolManifest(){
  return agentToolSpecs.map(({id,name,layer,source,operations,description})=>({
    id,name,layer,source,operations,description,status:"available"
  }));
}
