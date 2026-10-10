import type { ExecutionResult, MindCloudTask } from "./task-contract";
export interface RufloExecutionRequest { task:MindCloudTask; topology?:"mesh"|"hierarchical"|"hierarchical-mesh"|"adaptive"; maxAgents?:number; strategy?:"specialized"|"balanced"|"parallel"; }
export interface RufloTransport { execute(request:RufloExecutionRequest):Promise<ExecutionResult>; }
export class RufloAdapter { constructor(private readonly transport:RufloTransport){} execute(task:MindCloudTask):Promise<ExecutionResult>{return this.transport.execute({task,topology:"hierarchical-mesh",maxAgents:8,strategy:"specialized"});} }
