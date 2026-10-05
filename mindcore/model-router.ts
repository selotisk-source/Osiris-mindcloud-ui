import type {ModelProvider,ModelRequest,ModelResponse,HealthStatus} from "./contracts";
export class ModelRouter {
 private providers:ModelProvider[]=[];
 register(provider:ModelProvider){this.providers=[...this.providers.filter(p=>p.id!==provider.id),provider].sort((a,b)=>a.priority-b.priority);}
 list(){return [...this.providers];}
 async health():Promise<Record<string,HealthStatus>>{const e=await Promise.all(this.providers.map(async p=>[p.id,await p.health()] as const));return Object.fromEntries(e);}
 async complete(request:ModelRequest):Promise<ModelResponse>{
  const candidates=this.providers.filter(p=>p.supports(request)); if(!candidates.length) throw new Error("No model provider supports this request");
  const failures:string[]=[];
  for(const provider of candidates){try{const h=await provider.health();if(h.status==="offline"){failures.push(provider.id+": offline");continue;}return await provider.complete(request);}catch(error){failures.push(provider.id+": "+(error instanceof Error?error.message:String(error)));}}
  throw new Error("All model providers failed: "+failures.join("; "));
 }
}
