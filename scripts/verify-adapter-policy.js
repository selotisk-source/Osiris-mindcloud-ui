const assert = require("node:assert/strict");
const {executeWithRetry,isRetrySafeOperation,isTransientFailure} = require("../mindcloud/adapter-policy");
const {AdapterRuntime} = require("../mindcloud/adapter-runtime");
const native = require("../mindcloud/native-adapters");

(async () => {
  assert.equal(isRetrySafeOperation("query"),true);
  assert.equal(isRetrySafeOperation("discover_tools"),true);
  assert.equal(isRetrySafeOperation("remember"),false);
  assert.equal(isRetrySafeOperation("write"),false);
  assert.equal(isRetrySafeOperation("click"),false);
  assert.equal(isTransientFailure({ok:false,status:502}),true);
  assert.equal(isTransientFailure({ok:false,status:401}),false);
  assert.equal(isTransientFailure({ok:false,error:"adapter_credentials_missing"}),false);

  let calls = 0;
  const recovered = await executeWithRetry("query",async () => {
    calls++;
    return calls === 1 ? {ok:false,status:502,error:"provider_bad_gateway"} : {ok:true,status:200,result:{elements:[]}};
  },{waitFn:async () => {}});
  assert.equal(calls,2);
  assert.equal(recovered.value.ok,true);
  assert.deepEqual(recovered.execution,{contractVersion:"1.0",attempts:2,retries:1,retryPolicy:"transient-read-only",recovered:true});

  calls = 0;
  const exhausted = await executeWithRetry("query",async () => {
    calls++;
    return {ok:false,status:503,error:"provider_unavailable"};
  },{waitFn:async () => {}});
  assert.equal(calls,3);
  assert.equal(exhausted.execution.attempts,3);
  assert.equal(exhausted.execution.retries,2);
  assert.equal(exhausted.execution.recovered,false);

  calls = 0;
  const noRetry = await executeWithRetry("remember",async () => {
    calls++;
    return {ok:false,status:503,error:"provider_unavailable"};
  },{waitFn:async () => {}});
  assert.equal(calls,1,"write-like operations must not be retried automatically");
  assert.equal(noRetry.execution.retryPolicy,"no-automatic-retry");

  calls = 0;
  const thrown = await executeWithRetry("resolve",async () => {
    calls++;
    if (calls === 1) throw new Error("fetch failed: ECONNRESET");
    return {ok:true,status:200,result:{answers:[]}};
  },{waitFn:async () => {}});
  assert.equal(calls,2);
  assert.equal(thrown.value.ok,true);
  assert.equal(thrown.execution.recovered,true);

  const oldHealth=native.health;
  const oldExecute=native.execute;
  try {
    native.health=async id=>({ok:false,status:"credentials-missing",required:id==="shodan"?"SHODAN_API_KEY":undefined});
    native.execute=async()=>{throw new Error("health operation must not invoke provider execution");};
    const runtime=new AdapterRuntime({tools:[{id:"shodan",layer:"SecurityResearch",status:"adapter-ready",security:true,operations:["host","search","dns","health"]}]});
    const health=await runtime.execute({id:"shodan",operation:"health",input:{}});
    assert.equal(health.ok,false);
    assert.equal(health.result.status,"credentials-missing");
    assert.equal(health.execution.retryPolicy,"health-probe","health must use the common lifecycle, not a provider operation");
    assert.ok(health.requestId,"every adapter response must expose its correlation request ID");
    assert.equal(runtime.audit.at(-1).requestId,health.requestId,"returned request ID must match the audit record");
    assert.equal(runtime.runtimeState({id:"ruflo",transport:"stdio-mcp"}).transport,"stdio-mcp-readonly","native transport mode must not be mislabeled as HTTP");
  } finally {
    native.health=oldHealth;
    native.execute=oldExecute;
  }
  console.log(JSON.stringify({status:"verified",checks:["safe-operation-allowlist","transient-status-classification","retry-once-then-success","bounded-retries","no-retry-for-write-operations","retry-transient-network-errors","health-operation-uses-common-lifecycle","health-probe-does-not-require-action-approval","transport-mode-reported-truthfully"]},null,2));
})().catch(error => { console.error(error); process.exitCode=1; });
