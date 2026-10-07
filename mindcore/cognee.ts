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
 * Capability boundary for Cognee-backed persistent/graph memory.
 * The adapter stays unconnected until an explicit Cognee runtime endpoint
 * and credentials are supplied.
 */
export function cogneeMemoryCapability(adapter:CogneeAdapter):AgentCapability {
  return {
    id:"cognee-memory",
    layer:"Knowledge",
    status:"planned-adapter",
    approval:"admin",
    invoke:async(input:unknown,context:TaskContext)=>{
      requireApproval(context,"admin");
      const request=input as CogneeRequest;
      context.audit({
        taskId:context.taskId,
        type:"tool-call",
        timestamp:new Date().toISOString(),
        source:"cognee",
        data:{operation:request.operation,dataset:request.dataset,sessionId:request.sessionId}
      });
      return adapter.execute(request);
    }
  };
}
