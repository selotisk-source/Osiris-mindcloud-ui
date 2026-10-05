import type {AgentCapability,CapabilityStatus} from "./contracts";
export class CapabilityRegistry {
 private capabilities=new Map<string,AgentCapability>();
 register(capability:AgentCapability){this.capabilities.set(capability.id,capability);}
 get(id:string){const c=this.capabilities.get(id);if(!c)throw new Error("Unknown capability: "+id);return c;}
 list(status?:CapabilityStatus){return [...this.capabilities.values()].filter(c=>!status||c.status===status);}
}
