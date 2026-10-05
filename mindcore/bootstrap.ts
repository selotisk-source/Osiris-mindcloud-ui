import {CapabilityRegistry} from "./capability-registry";
import {MindOrchestrator} from "./orchestrator";
import {gatedComputerAgent} from "./adapters";
import {toolingCatalog} from "./catalog";
export function createMindCore(emit=(event:any)=>void){
 const registry=new CapabilityRegistry();
 registry.register(gatedComputerAgent());
 for(const item of toolingCatalog){
  if(item.id==="computer-use") continue;
  registry.register({id:item.id,layer:item.layer,status:"planned-adapter",approval:"user",invoke:async()=>({status:"adapter-placeholder",source:item.source,layer:item.layer})});
 }
 return{registry,orchestrator:new MindOrchestrator(registry,emit)};
}
