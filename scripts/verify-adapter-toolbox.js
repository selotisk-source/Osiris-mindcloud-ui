const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const html = fs.readFileSync("index.html", "utf8");
const registry = JSON.parse(fs.readFileSync("integrations/agent-tools.json", "utf8"));
const { AdapterRuntime } = require("../mindcloud/adapter-runtime");
const native = require("../mindcloud/native-adapters");

const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(source => source.trim());
assert.ok(scripts.length > 0, "UI must contain an executable script");
for (const [index, source] of scripts.entries()) {
  assert.doesNotThrow(() => new vm.Script(source, { filename: "index-inline-" + index + ".js" }),
    "inline UI script " + index + " must parse");
}

assert.match(html, /fetch\('\/api\/adapters'/, "toolbox must read the live adapter runtime");
assert.match(html, /data-adapter-action="health"/, "each adapter card must expose a live health action");
assert.match(html, /data-adapter-action="discover"/, "each adapter card must expose a discovery action");
assert.match(html, /registered-only adapters are not presented as running applications/i,
  "UI must distinguish a registry contract from a running adapter");
assert.match(html, /adapterHealthCache\[id\]=result/, "health result must be retained in the UI");
assert.match(html, /adapterDiscoveryCache\[id\]=result/, "discovery result must be retained in the UI");
assert.match(html, /readinessLabel/, "toolbox must display the runtime readiness state");
assert.match(html, /verificationText/, "toolbox must distinguish execution verification from registration and health");
assert.match(html, /readinessSummary/, "toolbox must display adapter readiness coverage totals");
assert.match(html, /fetch\(['"]\/api\/adapters\/execute['"]/, "integrated command console must call the existing protected execution endpoint");
assert.match(html, /['"]authorization['"]:'Bearer '\+token/, "protected execution call must attach the session token as a bearer credential");
assert.doesNotMatch(html, /(?:localStorage|sessionStorage)\.(?:setItem|getItem).*commandToken/i, "execution token must not be persisted in browser storage");
assert.match(html, /id="commandConsole"/, "OSIRIS must expose the integrated command console");
assert.match(html, /id="commandAdapter"/, "command console must select a live adapter");
assert.match(html, /id="commandOperation"/, "command console must select a declared operation");
assert.match(html, /id="commandToken" type="password"/, "execution credential must be masked in the UI");
assert.match(html, /id="commandTokenToggle"/, "operator must be able to explicitly reveal or remask the session token");
assert.match(html, /tokenInput\.type=reveal\?'text':'password'/, "token visibility control must toggle between masked and visible states");
assert.match(html, /['"]authorization['"]:'Bearer '\+token/, "execution must use the protected bearer-authenticated API");
assert.match(html, /id="commandConsoleResult"/, "command console must display the real API response");
assert.match(html, /id="clusterPlan"/, "OSIRIS console must expose bounded agent-cluster planning");
assert.match(html, /id="providerRun"/, "OSIRIS console must expose multi-provider collaboration");
assert.match(html, /\/api\/mindcloud\/providers\/collaborate/, "provider handoff must use the protected collaboration API");
assert.match(html, /name="providerChoice" value="gemini"/, "Gemini must be a selectable provider");
assert.match(html, /name="providerChoice" value="claude"/, "Claude must be a selectable provider");
assert.match(html, /name="providerChoice" value="grok"/, "Grok must be a selectable provider");
assert.match(html, /name="providerChoice" value="deepseek"/, "DeepSeek must be a selectable provider");
assert.match(html, /name="providerChoice" value="kimi"/, "Kimi must be a selectable provider");
assert.match(html, /\/api\/mindcloud\/agent-cluster\/plan/, "cluster plan must use the authenticated MindCloud API");
assert.match(html, /id="clusterBudget"/, "cluster plan must expose a bounded total token budget");
assert.match(html, /no external AI calls or adapter execution are started/i, "planning UI must not imply external agents were executed");
assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem).*commandToken/i, "execution token must not be persisted in browser storage");


const runtime = new AdapterRuntime(registry);
const snapshot = runtime.snapshot();
assert.equal(snapshot.adapters.length, registry.tools.length, "runtime status must cover every registered adapter");
assert.equal(snapshot.verificationScope, "current-runtime-session");
assert.equal(snapshot.readinessSummary.total, registry.tools.length);
assert.equal(snapshot.readinessSummary.verified, 0, "new runtime has no execution verification evidence");
assert.equal(snapshot.readinessSummary.executionNotVerified, registry.tools.length);
for (const adapter of snapshot.adapters) {
  assert.ok(adapter.id, "every adapter needs a stable ID");
  assert.ok(["configured", "registered-only"].includes(adapter.runtime.state),
    "every adapter must report a truthful runtime state");
  assert.ok(Array.isArray(adapter.runtime.operations),
    "every adapter must publish supported operation contracts");
  assert.ok(Array.isArray(adapter.runtime.executableOperations),
    "every adapter must publish the operations executable in its current configuration");
  assert.ok(adapter.runtime.executableOperations.every(operation=>adapter.runtime.operations.includes(operation)),
    "executable operations must be a subset of the declared effective contract");
  if (adapter.runtime.state === "registered-only") {
    assert.ok(adapter.runtime.executableOperations.every(operation=>operation === "health"),
      "unconfigured adapters must not advertise action execution as available");
  }
  if (native.supports(adapter.id)) {
    const expected = [...native.operationsFor(adapter.id), ...(registry.tools.find(tool=>tool.id===adapter.id).operations.includes("health")?["health"]:[])];
    assert.deepEqual(adapter.runtime.operations,expected,
      "native adapters must not advertise operations that their implementation cannot execute: "+adapter.id);
  }
}
assert.deepEqual(runtime.discover("overpass-turbo").adapter.operations,["query","export_geojson","health"]);
assert.deepEqual(runtime.discover("shodan").adapter.operations,["host","search","dns","health"]);
assert.deepEqual(runtime.discover("ruflo").adapter.operations,["discover_tools","health"]);

const browserBeforeEvidence = runtime.discover("browser-use").adapter.runtime;
assert.ok(["registered-only","configured"].includes(browserBeforeEvidence.readiness),
  "readiness must reflect whether the test environment has adapter configuration");
assert.equal(browserBeforeEvidence.healthStatus, "not-checked");
assert.equal(browserBeforeEvidence.verification.status, "not-verified",
  "configuration alone must never count as successful execution verification");
runtime.record("health-evidence-test", {ok:true,id:"browser-use",operation:"health",result:{status:"healthy"}});
const browserHealthy = runtime.discover("browser-use").adapter.runtime;
assert.equal(browserHealthy.healthStatus, "healthy");
assert.equal(browserHealthy.readiness, "healthy");
runtime.record("execution-evidence-test", {ok:true,id:"browser-use",operation:"browse",result:{title:"Example Domain"}});
const browserVerified = runtime.discover("browser-use").adapter.runtime;
assert.equal(browserVerified.readiness, "verified");
assert.equal(browserVerified.verification.status, "verified");
assert.equal(browserVerified.verification.operation, "browse");
assert.ok(browserVerified.verification.lastVerifiedAt);
assert.equal(browserVerified.healthStatus, "healthy", "execution verification must not erase the separate health result");
const verifiedSnapshot = runtime.snapshot();
assert.equal(verifiedSnapshot.readinessSummary.verified, 1);
assert.equal(verifiedSnapshot.readinessSummary.executionNotVerified, registry.tools.length - 1);

(async () => {
  const previousEndpoint = process.env.BROWSER_USE_SERVICE_URL;
  const previousKey = process.env.BROWSER_USE_API_KEY;
  try {
    process.env.BROWSER_USE_SERVICE_URL = "http://127.0.0.1:1";
    delete process.env.BROWSER_USE_API_KEY;
    const missingKeyRuntime = runtime.discover("browser-use").adapter.runtime;
    assert.equal(missingKeyRuntime.state, "registered-only",
      "browser-use must not be executable when its endpoint exists but its bearer credential is missing");
    assert.ok(missingKeyRuntime.missingConfiguration.includes("BROWSER_USE_API_KEY"));
    assert.equal(missingKeyRuntime.executableOperations.length, 0);
    const missingKeyHealth = await runtime.health("browser-use");
    assert.equal(missingKeyHealth.status, "credentials-missing",
      "browser-use health must expose missing credentials instead of probing an unauthenticated endpoint");

    process.env.BROWSER_USE_API_KEY = "test-only-placeholder";
    const readyRuntime = runtime.discover("browser-use").adapter.runtime;
    assert.equal(readyRuntime.state, "configured");
    assert.ok(readyRuntime.executableOperations.includes("browse"));
  } finally {
    if (previousEndpoint === undefined) delete process.env.BROWSER_USE_SERVICE_URL;
    else process.env.BROWSER_USE_SERVICE_URL = previousEndpoint;
    if (previousKey === undefined) delete process.env.BROWSER_USE_API_KEY;
    else process.env.BROWSER_USE_API_KEY = previousKey;
  }
  console.log("adapter-toolbox: verified UI syntax, lifecycle controls, native operation conformance, executable operation inventory, truthful external credentials, and protected execution boundary");
})().catch(error => { console.error(error); process.exitCode = 1; });
