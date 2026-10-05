export type CapabilityStatus = "planned-adapter" | "reference-only" | "available" | "degraded" | "disabled";
export type ApprovalLevel = "none" | "user" | "admin" | "human-gate";
export interface ModelRequest { taskId: string; model?: string; messages: Array<{role:"system"|"user"|"assistant";content:string}>; tools?: unknown[]; stream?: boolean; metadata?: Record<string,unknown>; }
export interface ModelResponse { provider:string; model:string; content:string; usage?:{inputTokens?:number;outputTokens?:number}; metadata?:Record<string,unknown>; }
export interface ModelProvider { id:string; priority:number; supports(request:ModelRequest):boolean; health():Promise<HealthStatus>; complete(request:ModelRequest):Promise<ModelResponse>; }
export interface HealthStatus { status:"healthy"|"degraded"|"offline"|"unknown"; checkedAt:string; latencyMs?:number; message?:string; metadata?:Record<string,unknown>; }
export interface AgentCapability { id:string; layer:string; status:CapabilityStatus; approval:ApprovalLevel; invoke(input:unknown,context:TaskContext):Promise<unknown>; }
export interface TaskContext { taskId:string; actor:string; approval:ApprovalLevel; audit:(event:RunEvent)=>void; }
export interface EvidenceArtifact { id:string; kind:"document"|"image"|"video"|"data"|"log"; uri:string; sha256?:string; source:string; createdAt:string; metadata?:Record<string,unknown>; }
export interface RunEvent { taskId:string; type:"start"|"tool-call"|"tool-result"|"evidence"|"approval"|"error"|"complete"; timestamp:string; source:string; data?:Record<string,unknown>; }
