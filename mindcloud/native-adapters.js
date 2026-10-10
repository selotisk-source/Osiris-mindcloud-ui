const rufloMcp = require("./ruflo-mcp");
const NATIVE = new Set(["overpass-turbo","google-street-view","shodan","opensanctions","subdomain-finder","mapillary","agentmemory","ruflo"]);

function state(id) {
  if (id === "ruflo") return {configured:process.env.RUFLO_MCP_ENABLED === "true",required:process.env.RUFLO_MCP_ENABLED === "true"?undefined:"RUFLO_MCP_ENABLED=true",mode:"stdio-mcp-readonly",operations:["health","discover_tools"]};
  if (id === "overpass-turbo" || id === "subdomain-finder") return {configured:true,mode:id === "subdomain-finder" ? "passive-public-data" : "native-http"};
  if (id === "agentmemory") return {configured:Boolean(process.env.COGNEE_SERVICE_URL),required:process.env.COGNEE_SERVICE_URL?undefined:"COGNEE_SERVICE_URL",mode:"cognee-persistent-memory",operations:["remember","observe","smart_search","context"]};
  if (id === "google-street-view") return {configured:Boolean(process.env.GOOGLE_MAPS_API_KEY),required:process.env.GOOGLE_MAPS_API_KEY?undefined:"GOOGLE_MAPS_API_KEY"};
  if (id === "shodan") return {configured:Boolean(process.env.SHODAN_API_KEY),required:process.env.SHODAN_API_KEY?undefined:"SHODAN_API_KEY"};
  if (id === "opensanctions") return {configured:Boolean(process.env.OPENSANCTIONS_API_KEY),required:process.env.OPENSANCTIONS_API_KEY?undefined:"OPENSANCTIONS_API_KEY"};
  if (id === "mapillary") return {configured:Boolean(process.env.MAPILLARY_ACCESS_TOKEN),required:process.env.MAPILLARY_ACCESS_TOKEN?undefined:"MAPILLARY_ACCESS_TOKEN"};
  return null;
}
function supports(id) { return NATIVE.has(id); }

async function health(id) {
  const s=state(id);
  if (!s) return null;
  if (!s.configured) return {ok:false,status:id === "ruflo" ? "disabled" : "credentials-missing",required:s.required};
  if (id === "ruflo") {
    try { const result=await rufloMcp.discoverTools(); return {ok:true,status:"healthy",mode:"stdio-mcp-readonly",server:result.server,protocolVersion:result.protocolVersion,toolCount:result.toolCount,executionEnabled:false}; }
    catch(error) { return {ok:false,status:"offline",mode:"stdio-mcp-readonly",error:error instanceof Error?error.message:String(error),executionEnabled:false}; }
  }
  if (id === "agentmemory") {
    const endpoint=process.env.COGNEE_SERVICE_URL.replace(/\/$/,"");
    try {
      const response=await fetch(endpoint+"/health",{headers:{accept:"application/json"},signal:AbortSignal.timeout(3000)});
      let details={};try{details=await response.json();}catch{}
      return {ok:response.ok,status:response.ok?"healthy":"degraded",httpStatus:response.status,endpoint,mode:"cognee-persistent-memory",details};
    } catch(error) {
      return {ok:false,status:"offline",endpoint,mode:"cognee-persistent-memory",error:error instanceof Error?error.message:String(error)};
    }
  }
  if (id === "subdomain-finder") return {ok:true,status:"configured",mode:"passive-public-data",providers:["crt.sh","Cloudflare DNS-over-HTTPS"]};
  if (id === "mapillary") return {ok:true,status:"configured",mode:"free-street-level-imagery",provider:"Mapillary"};
  if (id !== "overpass-turbo") return {ok:true,status:"configured",mode:"native-http"};
  try {
    const {response,endpoint}=await fetchOverpass("[out:json];node(1);out;",2500);
    let body=null;
    try { body=await response.json(); } catch {}
    const healthy=response.ok && Array.isArray(body?.elements);
    return {
      ok:healthy,
      status:healthy?"healthy":"degraded",
      httpStatus:response.status,
      endpoint,
      probe:"interpreter-json",
      ...(healthy?{}:{detail:body})
    };
  } catch(e) { return {ok:false,status:"offline",endpoint:overpassEndpoints(),probe:"interpreter-json",error:e instanceof Error?e.message:String(e)}; }
}
function overpassEndpoints() {
  const primary = process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter";
  const configured = (process.env.OVERPASS_API_FALLBACKS || "").split(",").map(value => value.trim()).filter(Boolean);
  const defaults = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.osm.jp/api/interpreter", "https://z.overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"];
  return [...new Set([primary, ...configured, ...defaults])];
}

async function fetchOverpass(query, timeoutMs=15000) {
  const endpoints = overpassEndpoints();
  let lastError;
  for (let index=0; index<endpoints.length; index++) {
    const endpoint=endpoints[index];
    try {
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{
          "content-type":"application/x-www-form-urlencoded;charset=UTF-8",
          "accept":"application/json",
          "user-agent":"MindCloud/1.0 (https://github.com/selotisk-source/Osiris-mindcloud-ui)"
        },
        body:new URLSearchParams({data:query}).toString(),
        signal:AbortSignal.timeout(timeoutMs)
      });
      if(response.ok) {
        let validOverpassJson=false;
        try {
          const payload=await response.clone().json();
          validOverpassJson=Array.isArray(payload?.elements);
        } catch {}
        if(validOverpassJson || index===endpoints.length-1) return {response,endpoint};
        await response.body?.cancel().catch(()=>{});
        continue;
      }
      const retryable=[429,500,502,503,504].includes(response.status);
      if(!retryable || index===endpoints.length-1) return {response,endpoint};
      await response.body?.cancel().catch(()=>{});
    } catch(error) {
      lastError=error;
      if(index===endpoints.length-1) throw error;
    }
  }
  throw lastError || new Error("overpass_all_endpoints_failed");
}

async function readResponse(response) {
  const contentType=response.headers.get("content-type")||"";
  if(contentType.includes("application/json")) { try{return await response.json();}catch{return {error:"invalid_json_response"};} }
  if(contentType.startsWith("image/")) return {contentType,base64:Buffer.from(await response.arrayBuffer()).toString("base64")};
  return {contentType,raw:(await response.text()).slice(0,20000)};
}
async function execute({id,operation,input={},requestId}) {
  if (id === "ruflo") {
    if (process.env.RUFLO_MCP_ENABLED !== "true") return {ok:false,id,operation,error:"adapter_disabled",required:"RUFLO_MCP_ENABLED=true",executionEnabled:false};
    if (operation !== "discover_tools" && operation !== "health") return {ok:false,id,operation,error:"operation_not_supported",supportedOperations:["health","discover_tools"],executionEnabled:false};
    try { const result=await rufloMcp.discoverTools(); return {ok:true,id,operation,result,evidence:{source:"stdio://ruflo-mcp/tools/list",retrievedAt:new Date().toISOString(),requestId,toolCount:result.toolCount,executionEnabled:false}}; }
    catch(error) { return {ok:false,id,operation,error:error instanceof Error?error.message:String(error),executionEnabled:false}; }
  }
  const timeout={signal:AbortSignal.timeout(15000)};
  let endpoint, response, headers={"accept":"application/json"};
  if(id==="agentmemory") {
    const base=(process.env.COGNEE_SERVICE_URL||"").replace(/\/$/,"");
    if(!base)return {ok:false,error:"adapter_not_configured",required:"COGNEE_SERVICE_URL"};
    const sessionId=String(input.sessionId||input.session_id||"mindcloud-default").slice(0,200);
    const datasetName=String(input.datasetName||input.dataset_name||process.env.MINDCLOUD_MEMORY_DATASET||"mindcloud-agents").slice(0,200);
    if(operation==="remember"||operation==="observe") {
      const content=String(input.content??input.text??input.observation??"").trim();
      if(!content)return {ok:false,error:"memory_content_required"};
      const form=new FormData();
      form.append("raw_data",content);
      form.append("datasetName",datasetName);
      form.append("session_id",sessionId);
      form.append("self_improvement","false");
      form.append("run_in_background","false");
      response=await fetch(base+"/api/v1/remember",{method:"POST",headers:{accept:"application/json"},body:form,signal:AbortSignal.timeout(20000)});
    } else if(operation==="smart_search"||operation==="context") {
      const query=String(input.query??input.text??input.context??"").trim();
      if(!query)return {ok:false,error:"memory_query_required"};
      response=await fetch(base+"/api/v1/recall",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({query,session_id:sessionId,scope:"session",only_context:true,top_k:Math.max(1,Math.min(Number(input.limit)||5,20))}),signal:AbortSignal.timeout(15000)});
    } else return {ok:false,error:"operation_not_supported",id,operation,supportedOperations:["remember","observe","smart_search","context"]};
    const result=await readResponse(response);
    return {ok:response.ok,id,operation,status:response.status,result,evidence:{source:base+"/api/v1/"+((operation==="remember"||operation==="observe")?"remember":"recall"),retrievedAt:new Date().toISOString(),requestId,sessionId,datasetName,storage:"Cognee persistent memory service"}};
  } else if(id==="mapillary") {
    if(!process.env.MAPILLARY_ACCESS_TOKEN) return {ok:false,error:"adapter_credentials_missing",required:"MAPILLARY_ACCESS_TOKEN"};
    let endpoint, response;
    const headers={accept:"application/json",authorization:"OAuth "+process.env.MAPILLARY_ACCESS_TOKEN};
    if(operation==="search") {
      const raw=String(input.bbox||"");
      const bbox=raw.split(",").map(v=>Number(v.trim()));
      if(bbox.length!==4||bbox.some(v=>!Number.isFinite(v))||bbox[0]<-180||bbox[2]>180||bbox[1]<-90||bbox[3]>90||bbox[0]>=bbox[2]||bbox[1]>=bbox[3]) return {ok:false,error:"valid_bbox_required",format:"minLon,minLat,maxLon,maxLat"};
      const params=new URLSearchParams({fields:"id,thumb_1024_url,geometry,captured_at,compass_angle,is_pano",bbox:bbox.join(","),limit:String(Math.max(1,Math.min(Number(input.limit)||20,100)))});
      endpoint="https://graph.mapillary.com/images?"+params.toString();
    } else if(operation==="image") {
      const imageId=String(input.id||"");
      if(!/^\d+$/.test(imageId)) return {ok:false,error:"numeric_mapillary_image_id_required"};
      const params=new URLSearchParams({fields:"id,thumb_1024_url,geometry,captured_at,compass_angle,is_pano"});
      endpoint="https://graph.mapillary.com/"+encodeURIComponent(imageId)+"?"+params.toString();
    } else return {ok:false,error:"operation_not_supported",id,operation};
    response=await fetch(endpoint,{...timeout,headers});
    const result=await readResponse(response);
    return {ok:response.ok,id,operation,status:response.status,result,evidence:{source:"https://graph.mapillary.com/",retrievedAt:new Date().toISOString(),requestId,provider:"Mapillary",costModel:"free-no-subscription"}};
  } else if(id==="subdomain-finder") {
    const domain=String(input.domain||"").trim().toLowerCase().replace(/\.$/,"");
    if(!domain || domain.length>253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return {ok:false,error:"valid_domain_required"};
    if(operation==="discover") {
      const base=process.env.NODE_ENV==="test"&&process.env.CRT_SH_URL?process.env.CRT_SH_URL:"https://crt.sh/";
      const endpoint=base+"?q="+encodeURIComponent("%."+domain)+"&output=json";
      const response=await fetch(endpoint,{...timeout,headers:{"accept":"application/json","user-agent":"MindCloud/1.0 (passive certificate-transparency lookup)"}});
      let rows=[]; try { rows=await response.json(); } catch {}
      if(!response.ok || !Array.isArray(rows)) return {ok:false,id,operation,status:response.status,error:"certificate_transparency_lookup_failed"};
      const names=[...new Set(rows.flatMap(row=>String(row.name_value||"").split(/\r?\n/)).map(name=>name.trim().toLowerCase().replace(/^\*\./,"")).filter(name=>name!==domain&&name.endsWith("."+domain)))].sort();
      return {ok:true,id,operation,status:response.status,result:{domain,subdomains:names,count:names.length,method:"passive-certificate-transparency",provider:"crt.sh"},evidence:{source:"https://crt.sh/",retrievedAt:new Date().toISOString(),requestId}};
    }
    if(operation==="resolve") {
      const name=String(input.name||domain).trim().toLowerCase().replace(/\.$/,"");
      if(!(name===domain||name.endsWith("."+domain))) return {ok:false,error:"name_outside_requested_domain"};
      const type=String(input.type||"A").toUpperCase();
      if(!["A","AAAA","CNAME","MX","NS","TXT"].includes(type)) return {ok:false,error:"unsupported_dns_record_type"};
      const base=process.env.NODE_ENV==="test"&&process.env.CLOUDFLARE_DNS_URL?process.env.CLOUDFLARE_DNS_URL:"https://cloudflare-dns.com/dns-query";
      const endpoint=base+"?name="+encodeURIComponent(name)+"&type="+encodeURIComponent(type);
      const response=await fetch(endpoint,{...timeout,headers:{accept:"application/dns-json"}});
      let result; try { result=await response.json(); } catch { result=null; }
      if(!response.ok||!result||typeof result.Status!=="number") return {ok:false,id,operation,status:response.status,error:"dns_lookup_failed"};
      return {ok:true,id,operation,status:response.status,result:{name,type,dnsStatus:result.Status,answers:(result.Answer||[]).map(a=>({name:a.name,type:a.type,data:a.data,ttl:a.TTL}))},evidence:{source:"https://cloudflare-dns.com/dns-query",retrievedAt:new Date().toISOString(),requestId}};
    }
    return {ok:false,error:"operation_not_supported",id,operation};
  } else if(id==="overpass-turbo") {
    if(!["query","export_geojson"].includes(operation)) return {ok:false,error:"operation_not_supported",id,operation};
    if(typeof input.query!=="string"||!input.query.trim()) return {ok:false,error:"query_required",id,operation};
    ({endpoint,response}=await fetchOverpass(input.query,15000));
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

  let result=await readResponse(response);
  if (id === "overpass-turbo" && operation === "export_geojson" && response.ok) {
    const elements = Array.isArray(result?.elements) ? result.elements : [];
    result = { type: "FeatureCollection", features: elements.flatMap(element => {
      let geometry = null;
      if (element.type === "node" && Number.isFinite(element.lon) && Number.isFinite(element.lat)) geometry = { type: "Point", coordinates: [element.lon, element.lat] };
      else if (element.type === "way" && Array.isArray(element.geometry) && element.geometry.length >= 2) {
        const coordinates = element.geometry.filter(point => Number.isFinite(point.lon) && Number.isFinite(point.lat)).map(point => [point.lon, point.lat]);
        if (coordinates.length >= 2) geometry = { type: "LineString", coordinates };
      }
      return geometry ? [{ type: "Feature", id: `${element.type}/${element.id}`, properties: { ...element.tags, osm_type: element.type, osm_id: element.id }, geometry }] : [];
    }) };
  }
  return {ok:response.ok,id,operation,status:response.status,result,evidence:{source:endpoint.split("?")[0],retrievedAt:new Date().toISOString(),requestId}};
}
module.exports={supports,state,health,execute};
