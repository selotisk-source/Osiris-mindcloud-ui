import {CapabilityRegistry} from "./capability-registry";
import {MindOrchestrator} from "./orchestrator";
import {gatedComputerAgent} from "./adapters";
import {toolingCatalog} from "./catalog";
import {createAgentToolCapabilities,ToolExecutor} from "./agent-tooling";
import {HttpCogneeAdapter,cogneeMemoryCapability} from "./cognee";

export function createMindCore(
  emit=(event:any)=>void,
  options:{toolExecutor?:ToolExecutor;cogneeEndpoint?:string}={}
){
 const registry=new CapabilityRegistry();
 registry.register(gatedComputerAgent());

 const integratedIds=new Set(["graft","openmontage","codebase-memory-mcp"]);
 if(options.toolExecutor){
  for(const capability of createAgentToolCapabilities(options.toolExecutor)){
   registry.register(capability);
  }
 }

 const cogneeEndpoint=options.cogneeEndpoint||process.env.COGNEE_ENDPOINT;
 if(cogneeEndpoint){
  registry.register(cogneeMemoryCapability(new HttpCogneeAdapter(cogneeEndpoint)));
 }

 for(const item of toolingCatalog){
  if(item.id==="computer-use"||integratedIds.has(item.id)||item.id==="cognee") continue;
  registry.register({
   id:item.id,
   layer:item.layer,
   status:"planned-adapter",
   approval:"user",
   invoke:async()=>({status:"adapter-placeholder",source:item.source,layer:item.layer})
  });
 }
 return{registry,orchestrator:new MindOrchestrator(registry,emit)};
}
