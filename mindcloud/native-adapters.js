const NATIVE = new Set(["overpass-turbo","google-street-view","shodan","opensanctions"]);

function state(id) {
  if (id === "overpass-turbo") return {configured:true};
  if (id === "google-street-view") return {configured:Boolean(process.env.GOOGLE_MAPS_API_KEY),required:process.env.GOOGLE_MAPS_API_KEY?undefined:"GOOGLE_MAPS_API_KEY"};
  if (id === "shodan") return {configured:Boolean(process.env.SHODAN_API_KEY),required:process.env.SHODAN_API_KEY?undefined:"SHODAN_API_KEY"};
  if (id === "opensanctions") return {configured:Boolean(process.env.OPENSANCTIONS_API_KEY),required:process.env.OPENSANCTIONS_API_KEY?undefined:"OPENSANCTIONS_API_KEY"};
  return null;
}
function supports(id) { return NATIVE.has(id); }

async function health(id) {
  const s=state(id);
  if (!s) return null;
  if (!s.configured) return {ok:false,status:"credentials-missing",required:s.required};
  if (id !== "overpass-turbo") return {ok:true,status:"configured",mode:"native-http"};
  const endpoint=process.env.OVERPASS_STATUS_URL||"https://overpass-api.de/api/status";
  try {
    const r=await fetch(endpoint,{signal:AbortSignal.timeout(5000)});
    return {ok:r.ok,status:r.ok?"healthy":"degraded",httpStatus:r.status,endpoint};
  } catch(e) { return {ok:false,status:"offline",endpoint,error:e instanceof Error?e.message:String(e)}; }
}
async function readResponse(response) {
  const contentType=response.headers.get("content-type")||"";
  if(contentType.includes("application/json")) { try{return await response.json();}catch{return {error:"invalid_json_response"};} }
  if(contentType.startsWith("image/")) return {contentType,base64:Buffer.from(await response.arrayBuffer()).toString("base64")};
  return {contentType,raw:(await response.text()).slice(0,20000)};
}
async function execute({id,operation,input={},requestId}) {
  const timeout={signal:AbortSignal.timeout(15000)};
  let endpoint, response, headers={"accept":"application/json"};
  if(id==="overpass-turbo") {
    if(!["query","export_geojson"].includes(operation)) return {ok:false,error:"operation_not_supported",id,operation};
    if(typeof input.query!=="string"||!input.query.trim()) return {ok:false,error:"query_required",id,operation};
    endpoint=process.env.OVERPASS_API_URL||"https://overpass-api.de/api/interpreter";
    response=await fetch(endpoint,{...timeout,method:"POST",headers:{"content-type":"application/x-www-form-urlencoded;charset=UTF-8","accept":"application/json"},body:new URLSearchParams({data:input.query}).toString()});
  } else if(id==="google-street-view") {
    if(!["metadata","image"].includes(operation)) return {ok:false,error:"operation_not_supported",id,operation};
    if(!process.env.GOOGLE_MAPS_API_KEY) return {ok:false,error:"adapter_credentials_missing",required:"GOOGLE_MAPS_API_KEY"};
    if(!input.location&&!input.pano) return {ok:false,error:"location_or_pano_required"};
    endpoint=operation==="metadata"?"https://maps.googleapis.com/maps/api/streetview/metadata":"https://maps.googleapis.com/maps/api/streetview";
    const params=new URLSearchParams({key:process.env.GOOGLE_MAPS_API_KEY});
    if(input.location)params.set("location",String(input.location));
    if(input.pano)params.set("pano",String(input.pano));
    if(operation==="image") {
      params.set("size",String(input.size||"640x400"));
      for(const key of ["heading","pitch","fov"])if(input[key]!==undefined)params.set(key,String(input[key]));
    }
    endpoint+="?"+params.toString();
    response=await fetch(endpoint,timeout);
  } else if(id==="shodan") {
    if(!process.env.SHODAN_API_KEY)return {ok:false,error:"adapter_credentials_missing",required:"SHODAN_API_KEY"};
    const base=(process.env.SHODAN_API_BASE_URL||"https://api.shodan.io").replace(/\/$/,"");
    const params=new URLSearchParams({key:process.env.SHODAN_API_KEY});
    if(operation==="host") {
      if(!input.ip)return {ok:false,error:"ip_required"};
      endpoint=base+"/shodan/host/"+encodeURIComponent(String(input.ip))+"?"+params;
    } else if(operation==="search") {
      if(!input.query)return {ok:false,error:"query_required"};
      params.set("query",String(input.query));
      endpoint=base+"/shodan/host/search?"+params;
    } else if(operation==="dns") {
      if(!input.domain)return {ok:false,error:"domain_required"};
      endpoint=base+"/dns/domain/"+encodeURIComponent(String(input.domain))+"?"+params;
    } else return {ok:false,error:"operation_not_supported",id,operation};
    response=await fetch(endpoint,timeout);
  } else if(id==="opensanctions") {
    if(!process.env.OPENSANCTIONS_API_KEY)return {ok:false,error:"adapter_credentials_missing",required:"OPENSANCTIONS_API_KEY"};
    const base=(process.env.OPENSANCTIONS_API_BASE_URL||"https://api.opensanctions.org").replace(/\/$/,"");
    headers.authorization="ApiKey "+process.env.OPENSANCTIONS_API_KEY;
    if(operation==="search") {
      if(!input.query)return {ok:false,error:"query_required"};
      const params=new URLSearchParams({q:String(input.query),limit:String(Math.min(Number(input.limit)||10,100))});
      endpoint=base+"/search/"+encodeURIComponent(String(input.dataset||"default"))+"?"+params;
      response=await fetch(endpoint,{...timeout,headers});
    } else if(operation==="match") {
      if(!input.name)return {ok:false,error:"name_required"};
      endpoint=base+"/match/"+encodeURIComponent(String(input.dataset||"default"));
      const properties={name:[String(input.name)]};
      for(const key of ["birthDate","nationality","country","address"])if(input[key]!==undefined)properties[key]=Array.isArray(input[key])?input[key]:[String(input[key])];
      response=await fetch(endpoint,{...timeout,method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({queries:{mindcloud:{schema:String(input.schema||"Person"),properties}}})});
    } else return {ok:false,error:"operation_not_supported",id,operation};
  } else return {ok:false,error:"native_adapter_not_implemented",id,operation};

  const result=await readResponse(response);
  return {ok:response.ok,id,operation,status:response.status,result,evidence:{source:endpoint.split("?")[0],retrievedAt:new Date().toISOString(),requestId}};
}
module.exports={supports,state,health,execute};
