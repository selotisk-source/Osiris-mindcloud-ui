import type {AgentCapability,ApprovalLevel,TaskContext} from "./contracts";
import {requireApproval} from "./approval-gate";

export type AgentToolId =
  | "graft"
  | "openmontage"
  | "codebase-memory-mcp"
  | "browser-use"
  | "agentmemory"
  | "scientific-agent-skills"
  | "diagram-design"
  | "anthropic-cybersecurity-skills"
  | "awesome-harness-engineering"
  | "openviking";

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
  },
  {
    id:"browser-use",
    name:"Browser Use",
    layer:"ComputerAgent",
    source:"browser-use/browser-use",
    operations:["browse","navigate","click","type","extract","screenshot"],
    approval:"admin",
    description:"Browser automation surface for supervised computer-use tasks; browser sessions remain isolated execution domains."
  },
  {
    id:"agentmemory",
    name:"AgentMemory",
    layer:"AgentMemory",
    source:"rohitg00/agentmemory",
    operations:["remember","observe","smart_search","context","forget","session_start","session_end"],
    approval:"admin",
    description:"Persistent cross-agent coding memory with MCP/REST access; memory storage and credentials remain in its execution domain."
  },
  {
    id:"scientific-agent-skills",
    name:"Scientific Agent Skills",
    layer:"ResearchAgent",
    source:"K-Dense-AI/scientific-agent-skills",
    operations:["list_skills","search_skill","run_skill","search_database","analyze","cite"],
    approval:"admin",
    description:"Agent Skills-compatible scientific and research skill library; selected skills are invoked through a controlled research workspace."
  },
  {
    id:"diagram-design",
    name:"Diagram Design",
    layer:"Visualization",
    source:"cathrynlavery/diagram-design",
    operations:["generate","redraw","validate","export"],
    approval:"admin",
    description:"Editorial HTML/SVG diagram skill for architecture, evidence and system visualizations."
  },
  {
    id:"anthropic-cybersecurity-skills",
    name:"Anthropic Cybersecurity Skills",
    layer:"SecurityResearch",
    source:"mukul975/Anthropic-Cybersecurity-Skills",
    operations:["discover_skill","assess","hunt","incident_response","map_framework","validate"],
    approval:"admin",
    description:"Structured cybersecurity skills library. Use only in explicitly authorized security research and defensive workflows."
  },
  {
    id:"awesome-harness-engineering",
    name:"Awesome Harness Engineering",
    layer:"HarnessEngineering",
    source:"harness-engineer/awesome-harness-engineering",
    operations:["catalog","inspect","evaluate","benchmark","map_pattern"],
    approval:"admin",
    description:"Curated harness-engineering patterns used as a reference layer for reliable agent environments and orchestration."
  },
  {
    id:"openviking",
    name:"OpenViking",
    layer:"ContextDatabase",
    source:"volcengine/OpenViking",
    operations:["ls","tree","read","find","retrieve","import","write"],
    approval:"admin",
    description:"Filesystem-oriented context database unifying knowledge, memory and skills behind an inspectable context surface."
  }
];

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
