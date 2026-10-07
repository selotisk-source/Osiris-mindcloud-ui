import {AgentCapability,TaskContext} from "./contracts";

export type GroundedOperation="health"|"process";

export interface GroundedRequest{
  operation:GroundedOperation;
  inputUri?:string;
  options?:Record<string,unknown>;
}

export interface GroundedResult{
  provider:"grounded-superintelligence";
  operation:GroundedOperation;
  status:"configured"|"not-configured";
  endpoint?:string;
  output?:unknown;
  note?:string;
}

export function groundedApiCapability(endpoint=process.env.GROUNDED_API_ENDPOINT):AgentCapability{
  return {
    id:"grounded-api",
    layer:"SpatialIntelligence",
    status:endpoint?"available":"planned-adapter",
    approval:"user",
    invoke:async(input,context:TaskContext):Promise<GroundedResult>=>{
      const request=input as GroundedRequest;
      const operation=request?.operation||"health";
      context.audit({
        taskId:context.taskId,
        type:"tool-call",
        timestamp:new Date().toISOString(),
        source:"grounded-api",
        data:{operation,inputUri:request?.inputUri}
      });
      const result:GroundedResult={
        provider:"grounded-superintelligence",
        operation,
        status:endpoint?"configured":"not-configured",
        endpoint,
        note:endpoint
          ?"Endpoint configured; authentication and request schema remain deployment-specific and must be verified before live calls."
          :"Grounded API is registered as the Spatial Intelligence adapter; configure GROUNDED_API_ENDPOINT only after an authorized API endpoint and schema are available."
      };
      context.audit({
        taskId:context.taskId,
        type:"tool-result",
        timestamp:new Date().toISOString(),
        source:"grounded-api",
        data:{status:result.status}
      });
      return result;
    }
  };
}
