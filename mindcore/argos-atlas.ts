import {AgentCapability,TaskContext} from "./contracts";

export const ARGOS_ATLAS_URL="https://www.argosatlas.com/";

export type ArgosAtlasOperation="open"|"describe";

export interface ArgosAtlasRequest{
  operation:ArgosAtlasOperation;
  region?:string;
  layer?: "cameras"|"flights"|"ships"|"infrastructure"|"events"|"markets"|"risk-zones";
}

export interface ArgosAtlasResult{
  provider:"argos-atlas";
  status:"available"|"external-api-pending";
  url:string;
  operation:ArgosAtlasOperation;
  region?:string;
  layer?:string;
  note?:string;
}

export function argosAtlasCapability():AgentCapability{
  return {
    id:"argos-atlas",
    layer:"GeoOSINT",
    status:"available",
    approval:"user",
    invoke:async(input,context:TaskContext):Promise<ArgosAtlasResult>=>{
      const request=input as ArgosAtlasRequest;
      const operation=request?.operation||"open";
      context.audit({
        taskId:context.taskId,
        type:"tool-call",
        timestamp:new Date().toISOString(),
        source:"argos-atlas",
        data:{operation,region:request?.region,layer:request?.layer}
      });
      const result:ArgosAtlasResult={
        provider:"argos-atlas",
        status:"external-api-pending",
        url:ARGOS_ATLAS_URL,
        operation,
        region:request?.region,
        layer:request?.layer,
        note:"ARGOS ATLAS is currently an external live atlas. Its API/MCP is announced but not yet generally available; MindCore does not invent or scrape an API contract."
      };
      context.audit({
        taskId:context.taskId,
        type:"tool-result",
        timestamp:new Date().toISOString(),
        source:"argos-atlas",
        data:{status:result.status,url:result.url,layer:result.layer}
      });
      return result;
    }
  };
}
