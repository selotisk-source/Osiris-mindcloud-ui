const assert = require("node:assert/strict");
const native = require("../mindcloud/native-adapters");

const originalFetch = global.fetch;
const calls = [];
global.fetch = async (url, options={}) => {
  const urlText=String(url);
  calls.push({url:urlText,options});
  const isMainApi=urlText.includes("overpass-api.de")&&!urlText.includes("z.overpass-api.de")&&!urlText.includes("lz4.overpass-api.de");
  const unavailable=urlText.includes("overpass-primary") || isMainApi || urlText.includes("overpass.private.coffee") || urlText.includes("maps.mail.ru") || urlText.includes("overpass.osm.jp");
  const failureStatus=urlText.includes("overpass-primary-500.test")?500:502;
  const body=()=>urlText.includes("invalid-200.test")?{error:"upstream returned non-Overpass JSON"}:urlText.includes("graph.mapillary.com")?{data:[{id:"12345",thumb_1024_url:"https://images.example/12345.jpg",geometry:{type:"Point",coordinates:[27.9,43.2]},captured_at:1700000000}]}:urlText.includes("crt.sh")?[{name_value:"www.example.com\napi.example.com\n*.example.com\nnotexample.com"}]:urlText.includes("cloudflare-dns.com")?{Status:0,Answer:[{name:"www.example.com",type:1,data:"203.0.113.10",TTL:60}]}:urlText.includes("overpass.osm.jp")||urlText.includes("lz4.overpass-api.de")?{elements:[]}:urlText.includes("overpass.test")?{elements:[{type:"node",id:7,lat:43.2,lon:27.9,tags:{name:"Test point"}}]}:{mock:true,items:[],status:"OK"};
  return {
    ok:!unavailable,status:unavailable?failureStatus:200,
    headers:{get:(key)=>key.toLowerCase()==="content-type"?"application/json":"application/json"},
    json:async()=>body(),
    clone:()=>({json:async()=>body()}),
    body:{cancel:async()=>{}}
  };
};

(async()=>{
  delete process.env.OVERPASS_API_FALLBACKS;
  process.env.OVERPASS_API_URL="https://overpass.test/api/interpreter";
  process.env.GOOGLE_MAPS_API_KEY="test-google-key";
  process.env.SHODAN_API_KEY="test-shodan-key";
  process.env.OPENSANCTIONS_API_KEY="test-sanctions-key";
  process.env.MAPILLARY_ACCESS_TOKEN="test-mapillary-token";
  process.env.COGNEE_SERVICE_URL="http://cognee.test";
  process.env.MINDCLOUD_AUTHORIZED_DOMAINS="example.com";

  const registry=[
    {id:"overpass-turbo",operations:["query","export_geojson"]},
    {id:"subdomain-finder",operations:["discover","resolve"]},
    {id:"mapillary",operations:["search","image"]},
    {id:"google-street-view",operations:["metadata","image"]},
    {id:"shodan",operations:["host","search","dns"]},
    {id:"opensanctions",operations:["search","match"]},
    {id:"agentmemory",operations:["remember","observe","smart_search","context"]}
  ];
  assert.equal(native.supports("overpass-turbo"),true);
  assert.equal(native.state("overpass-turbo").configured,true);
  const overpass=await native.execute({id:"overpass-turbo",operation:"query",input:{query:'[out:json];node(1);out;'},requestId:"test-overpass"});
  assert.equal(overpass.ok,true);
  assert.equal(calls[0].url,"https://overpass.test/api/interpreter");
  assert.match(calls[0].options.body,/data=/);
  assert.equal(overpass.evidence.requestId,"test-overpass");
  const geojson=await native.execute({id:"overpass-turbo",operation:"export_geojson",input:{query:"[out:json];node(1);out;"},requestId:"test-geojson"});
  assert.equal(geojson.result.type,"FeatureCollection");
  assert.deepEqual(geojson.result.features[0].geometry,{type:"Point",coordinates:[27.9,43.2]});

  const street=await native.execute({id:"google-street-view",operation:"metadata",input:{location:"Varna, Bulgaria"},requestId:"test-street"});
  assert.equal(street.ok,true);
  assert.match(calls[2].url,/maps\.googleapis\.com\/maps\/api\/streetview\/metadata/);
  assert.match(calls[2].url,/key=test-google-key/);

  const shodan=await native.execute({id:"shodan",operation:"search",input:{query:"hostname:example.com"},requestId:"test-shodan"});
  assert.equal(shodan.ok,true);
  assert.match(calls[3].url,/api\.shodan\.io\/shodan\/host\/search/);
  assert.match(calls[3].url,/key=test-shodan-key/);

  const sanctions=await native.execute({id:"opensanctions",operation:"match",input:{name:"Example Person"},requestId:"test-sanctions"});
  assert.equal(sanctions.ok,true);
  assert.match(calls[4].url,/api\.opensanctions\.org\/match\/default/);
  assert.equal(calls[4].options.headers.authorization,"ApiKey test-sanctions-key");
  const subdomains=await native.execute({id:"subdomain-finder",operation:"discover",input:{domain:"example.com"},requestId:"test-subdomains"});
  assert.equal(subdomains.ok,true);
  assert.deepEqual(subdomains.result.subdomains,["api.example.com","www.example.com"]);
  assert.equal(subdomains.result.method,"passive-certificate-transparency");
  assert.match(calls[5].url,/crt\.sh/);
  const dns=await native.execute({id:"subdomain-finder",operation:"resolve",input:{domain:"example.com",name:"www.example.com",type:"A"},requestId:"test-dns"});
  assert.equal(dns.ok,true);
  assert.equal(dns.result.answers[0].data,"203.0.113.10");
  assert.match(calls[6].url,/cloudflare-dns\.com/);
  const outOfScope=await native.execute({id:"subdomain-finder",operation:"resolve",input:{domain:"example.com",name:"example.net"},requestId:"test-dns-scope"});
  assert.equal(outOfScope.error,"name_outside_requested_domain");
  const callsBeforeInvalidDns=calls.length;
  const invalidDns=await native.execute({id:"subdomain-finder",operation:"resolve",input:{domain:"example.com",name:"not a dns name",type:"A"},requestId:"test-invalid-dns-name"});
  assert.equal(invalidDns.error,"valid_dns_name_required");
  assert.equal(calls.length,callsBeforeInvalidDns,"invalid DNS names must be rejected before a provider request");
  const unauthorizedDomain=await native.execute({id:"subdomain-finder",operation:"discover",input:{domain:"example.net"},requestId:"test-unauthorized-domain"});
  assert.equal(unauthorizedDomain.error,"domain_not_authorized");
  const savedAllowlist=process.env.MINDCLOUD_AUTHORIZED_DOMAINS;
  delete process.env.MINDCLOUD_AUTHORIZED_DOMAINS;
  assert.equal(native.state("subdomain-finder").configured,false);
  const missingAllowlist=await native.execute({id:"subdomain-finder",operation:"discover",input:{domain:"example.com"},requestId:"test-missing-domain-allowlist"});
  assert.equal(missingAllowlist.error,"authorized_domain_allowlist_missing");
  const missingScopeHealth=await native.health("subdomain-finder");
  assert.equal(missingScopeHealth.status,"authorization-scope-missing");
  process.env.MINDCLOUD_AUTHORIZED_DOMAINS=savedAllowlist;
  const denied=await native.execute({id:"shodan",operation:"host",input:{},requestId:"test-invalid"});
  assert.equal(denied.error,"ip_required");

  const overpassHealth=await native.health("overpass-turbo");
  assert.equal(overpassHealth.status,"healthy");
  assert.equal(overpassHealth.probe,"interpreter-json");
  assert.equal(calls[7].url,"https://overpass.test/api/interpreter");
  assert.equal(calls[7].options.method,"POST");
  assert.match(calls[7].options.body,/data=/);

  const mapillary=await native.execute({id:"mapillary",operation:"search",input:{bbox:"27.8,43.1,28.0,43.3",limit:10},requestId:"test-mapillary"});
  assert.equal(mapillary.ok,true);
  assert.equal(mapillary.result.data[0].id,"12345");
  assert.match(calls[8].url,/graph\.mapillary\.com\/images/);
  assert.equal(calls[8].options.headers.authorization,"OAuth test-mapillary-token");

  const invalidMapillary=await native.execute({id:"mapillary",operation:"search",input:{bbox:"28,43,27,44"},requestId:"test-mapillary-invalid"});
  assert.equal(invalidMapillary.error,"valid_bbox_required");

  process.env.OVERPASS_API_URL="https://overpass-primary.test/api/interpreter";
  process.env.OVERPASS_API_FALLBACKS="https://overpass.test/api/interpreter";
  const fallbackHealth=await native.health("overpass-turbo");
  assert.equal(fallbackHealth.status,"healthy");
  assert.equal(fallbackHealth.endpoint,"https://overpass.test/api/interpreter");
  assert.equal(calls[9].url,"https://overpass-primary.test/api/interpreter");
  assert.equal(calls[10].url,"https://overpass.test/api/interpreter");
  const fallbackQuery=await native.execute({id:"overpass-turbo",operation:"query",input:{query:"[out:json];node(1);out;"},requestId:"test-overpass-fallback"});
  assert.equal(fallbackQuery.ok,true);
  assert.equal(fallbackQuery.evidence.source,"https://overpass.test/api/interpreter");
  assert.equal(calls[11].url,"https://overpass-primary.test/api/interpreter");
  assert.equal(calls[12].url,"https://overpass.test/api/interpreter");

  process.env.OVERPASS_API_URL="https://overpass-primary-500.test/api/interpreter";
  process.env.OVERPASS_API_FALLBACKS="https://overpass.test/api/interpreter";
  const fallback500=await native.execute({id:"overpass-turbo",operation:"query",input:{query:"[out:json];node(1);out;"},requestId:"test-overpass-500-fallback"});
  assert.equal(fallback500.ok,true);
  assert.equal(fallback500.status,200);
  assert.equal(fallback500.evidence.source,"https://overpass.test/api/interpreter");
  assert.equal(calls[13].url,"https://overpass-primary-500.test/api/interpreter");
  assert.equal(calls[14].url,"https://overpass.test/api/interpreter");

  delete process.env.OVERPASS_API_FALLBACKS;
  process.env.OVERPASS_API_URL="https://overpass-api.de/api/interpreter";
  const defaultMirrorHealth=await native.health("overpass-turbo");
  assert.equal(defaultMirrorHealth.status,"healthy");
  assert.equal(defaultMirrorHealth.endpoint,"https://lz4.overpass-api.de/api/interpreter");
  assert.deepEqual(calls.slice(15,21).map(call=>call.url),[
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter"
  ]);

  process.env.OVERPASS_API_URL="https://overpass-invalid-200.test/api/interpreter";
  process.env.OVERPASS_API_FALLBACKS="https://overpass.test/api/interpreter";
  const invalidBodyFallback=await native.health("overpass-turbo");
  assert.equal(invalidBodyFallback.status,"healthy");
  assert.equal(invalidBodyFallback.endpoint,"https://overpass.test/api/interpreter");
  assert.equal(calls[21].url,"https://overpass-invalid-200.test/api/interpreter");
  assert.equal(calls[22].url,"https://overpass.test/api/interpreter");

  assert.equal(native.supports("agentmemory"),true);
  assert.equal(native.state("agentmemory").configured,true);
  assert.deepEqual(native.state("agentmemory").operations,["remember","observe","smart_search","context"]);
  const memoryHealth=await native.health("agentmemory");
  assert.equal(memoryHealth.status,"healthy");
  assert.equal(calls.at(-1).url,"http://cognee.test/health");
  const memoryWrite=await native.execute({id:"agentmemory",operation:"remember",input:{content:"adapter memory test",sessionId:"agentmemory-test",datasetName:"mindcloud-tests"},requestId:"test-memory-write"});
  assert.equal(memoryWrite.ok,true);
  assert.equal(calls.at(-1).url,"http://cognee.test/api/v1/remember");
  assert.ok(calls.at(-1).options.body instanceof FormData);
  assert.equal(calls.at(-1).options.body.get("raw_data"),"adapter memory test");
  assert.equal(calls.at(-1).options.body.get("session_id"),"agentmemory-test");
  const memoryRecall=await native.execute({id:"agentmemory",operation:"smart_search",input:{query:"adapter memory test",sessionId:"agentmemory-test",limit:8},requestId:"test-memory-recall"});
  assert.equal(memoryRecall.ok,true);
  assert.equal(calls.at(-1).url,"http://cognee.test/api/v1/recall");
  assert.deepEqual(JSON.parse(calls.at(-1).options.body),{query:"adapter memory test",session_id:"agentmemory-test",scope:"session",only_context:true,top_k:8});
  const missingMemory=await native.execute({id:"agentmemory",operation:"remember",input:{},requestId:"test-memory-empty"});
  assert.equal(missingMemory.error,"memory_content_required");
  const unsupportedMemory=await native.execute({id:"agentmemory",operation:"forget",input:{},requestId:"test-memory-forget"});
  assert.equal(unsupportedMemory.error,"operation_not_supported");

  console.log("native-adapters: verified Overpass six-mirror failover and invalid-200-response failover, free passive subdomain/DNS, Mapillary, credential-gated APIs and Cognee-backed AgentMemory");
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;});
