const assert = require("node:assert/strict");
const native = require("../mindcloud/native-adapters");

const originalFetch = global.fetch;
const calls = [];
global.fetch = async (url, options={}) => {
  calls.push({url:String(url),options});
  return {
    ok:true,status:200,
    headers:{get:(key)=>key.toLowerCase()==="content-type"?"application/json":"application/json"},
    json:async()=>String(url).includes("crt.sh")?[{name_value:"www.example.com\napi.example.com\\n*.example.com\\nnotexample.com"}]:String(url).includes("cloudflare-dns.com")?{Status:0,Answer:[{name:"www.example.com",type:1,data:"203.0.113.10",TTL:60}]}:String(url).includes("overpass.test")?{elements:[{type:"node",id:7,lat:43.2,lon:27.9,tags:{name:"Test point"}}]}:{mock:true,items:[],status:"OK"}
  };
};

(async()=>{
  process.env.OVERPASS_API_URL="https://overpass.test/api/interpreter";
  process.env.GOOGLE_MAPS_API_KEY="test-google-key";
  process.env.SHODAN_API_KEY="test-shodan-key";
  process.env.OPENSANCTIONS_API_KEY="test-sanctions-key";

  const registry=[
    {id:"overpass-turbo",operations:["query","export_geojson"]},
    {id:"subdomain-finder",operations:["discover","resolve"]},
    {id:"google-street-view",operations:["metadata","image"]},
    {id:"shodan",operations:["host","search","dns"]},
    {id:"opensanctions",operations:["search","match"]}
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
  assert.match(calls[6].url,/crt\.sh/);
  const dns=await native.execute({id:"subdomain-finder",operation:"resolve",input:{domain:"example.com",name:"www.example.com",type:"A"},requestId:"test-dns"});
  assert.equal(dns.ok,true);
  assert.equal(dns.result.answers[0].data,"203.0.113.10");
  assert.match(calls[7].url,/cloudflare-dns\.com/);
  const outOfScope=await native.execute({id:"subdomain-finder",operation:"resolve",input:{domain:"example.com",name:"example.net"},requestId:"test-dns-scope"});
  assert.equal(outOfScope.error,"name_outside_requested_domain");
  const denied=await native.execute({id:"shodan",operation:"host",input:{},requestId:"test-invalid"});
  assert.equal(denied.error,"ip_required");

  const overpassHealth=await native.health("overpass-turbo");
  assert.equal(overpassHealth.status,"healthy");
  assert.equal(overpassHealth.probe,"interpreter-json");
  assert.equal(calls[5].url,"https://overpass.test/api/interpreter");
  assert.equal(calls[5].options.method,"POST");
  assert.match(calls[5].options.body,/data=/);

  console.log("native-adapters: verified Overpass execution and interpreter health, Street View metadata, Shodan and OpenSanctions request/response contracts");
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;});
