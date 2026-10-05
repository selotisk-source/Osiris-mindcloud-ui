import type {AgentCapability,ModelProvider,HealthStatus,ModelRequest,ModelResponse,TaskContext} from "./contracts";
import {requireApproval} from "./approval-gate";
export function plannedProvider(id:string,priority:number):ModelProvider{return{
 id,priority,supports:(_r:ModelRequest)=>false,
 health:async():Promise<HealthStatus>=>({status:"unknown",checkedAt:new Date().toISOString(),message:"Adapter registered but external runtime is not connected"}),
 complete:async(_r:ModelRequest):Promise<ModelResponse>=>{throw new Error("Provider adapter '"+id+"' is not connected");}
};}
export function gatedComputerAgent():AgentCapability{return{
 id:"computer-use",layer:"ComputerAgent",status:"planned-adapter",approval:"admin",
 invoke:async(_input:unknown,context:TaskContext)=>{requireApproval(context,"admin");context.audit({taskId:context.taskId,type:"tool-call",timestamp:new Date().toISOString(),source:"computer-use",data:{action:"sandboxed-computer-operation"}});return{status:"adapter-ready",sandboxRequired:true};}
};}
