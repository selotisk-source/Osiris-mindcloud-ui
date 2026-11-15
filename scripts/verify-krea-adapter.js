#!/usr/bin/env node
const assert=require("node:assert/strict");
const native=require("../mindcloud/native-adapters");
const {validateAdapterInput}=require("../mindcloud/adapter-contracts");
(async()=>{
  const savedKey=process.env.KREA_API_KEY;
  const originalFetch=global.fetch;
  try {
    delete process.env.KREA_API_KEY;
    assert.equal(native.supports("krea"),true);
    assert.equal(native.state("krea").configured,false);
    assert.equal((await native.execute({id:"krea",operation:"generate_image",input:{prompt:"test"},requestId:"krea-no-key"})).error,"adapter_credentials_missing");
    process.env.KREA_API_KEY="test-krea-token";
    assert.equal(validateAdapterInput("krea","generate_image",{prompt:"a test image"}).ok,true);
    assert.equal(validateAdapterInput("krea","generate_image",{}).ok,false);
    assert.equal(validateAdapterInput("krea","get_job",{job_id:"job-12345678"}).ok,true);
    const calls=[];
    global.fetch=async(url,options)=>{calls.push({url:String(url),options});return {ok:true,status:200,headers:{get:()=>"application/json"},json:async()=>({job_id:"job-12345678",status:"queued"}),text:async()=>JSON.stringify({job_id:"job-12345678",status:"queued"})};};
    const generated=await native.execute({id:"krea",operation:"generate_image",input:{prompt:"editorial illustration",aspect_ratio:"16:9",resolution:"1K"},requestId:"krea-image-test"});
    assert.equal(generated.ok,true);
    assert.equal(generated.result.status,"queued");
    assert.equal(calls[0].url,"https://api.krea.ai/generate/image/krea/krea-2/medium");
    assert.equal(calls[0].options.headers.authorization,"Bearer test-krea-token");
    assert.deepEqual(JSON.parse(calls[0].options.body),{prompt:"editorial illustration",aspect_ratio:"16:9",resolution:"1K"});
    const job=await native.execute({id:"krea",operation:"get_job",input:{job_id:"job-12345678"},requestId:"krea-job-test"});
    assert.equal(job.ok,true);
    assert.equal(calls[1].url,"https://api.krea.ai/jobs/job-12345678");
    assert.equal(calls[1].options.method,"GET");
    const invalid=await native.execute({id:"krea",operation:"get_job",input:{job_id:"../secret"},requestId:"krea-invalid-job"});
    assert.equal(invalid.error,"valid_job_id_required");
  
    const fs=require("node:fs");
    const serverSource=fs.readFileSync(require("node:path").join(__dirname,"../server.js"),"utf8");
    assert.ok(serverSource.includes('pathname==="/api/krea/generate"'),"POST Krea generate route must be wired");
    assert.ok(serverSource.includes('pathname.startsWith("/api/krea/jobs/")'),"Krea job retrieval route must be wired");
    assert.ok(serverSource.includes("adapters.execute({...task,approved})"),"Krea routes must use the shared adapter runtime");
    assert.ok(serverSource.includes("MINDCLOUD_TOOL_EXECUTION_TOKEN"),"Krea routes must require the MindCloud execution token");
  console.log("krea-adapter: contract, credential gate, image job submission, bearer isolation and job retrieval passed");
  } finally {
    global.fetch=originalFetch;
    if(savedKey===undefined)delete process.env.KREA_API_KEY;else process.env.KREA_API_KEY=savedKey;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
