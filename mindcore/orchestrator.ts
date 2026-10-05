import type {AgentCapability,TaskContext,RunEvent} from "./contracts";
import {CapabilityRegistry} from "./capability-registry";
export class MindOrchestrator {
 constructor(private registry:CapabilityRegistry,private emit:(event:RunEvent)=>void){}
 async run(capabilityId:string,input:unknown,context:TaskContext){
  const capability=this.registry.get(capabilityId);
  this.emit({taskId:context.taskId,type:"start",timestamp:new Date().toISOString(),source:"MindOrchestrator"});
  try{
   const result=await capability.invoke(input,context);
   this.emit({taskId:context.taskId,type:"complete",timestamp:new Date().toISOString(),source:capabilityId});
   return result;
  }catch(error){
   this.emit({taskId:context.taskId,type:"error",timestamp:new Date().toISOString(),source:capabilityId,data:{error:error instanceof Error?error.message:String(error)}});
   throw error;
  }
 }
}
export function auditContext(taskId:string,actor:string,approval:TaskContext["approval"],emit:(e:RunEvent)=>void):TaskContext{
 return{taskId,actor,approval,audit:emit};
}
