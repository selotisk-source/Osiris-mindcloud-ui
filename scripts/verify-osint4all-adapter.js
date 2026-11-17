const assert = require("node:assert/strict");
const fs = require("node:fs");
const catalogue = require("../mindcloud/osint4all-catalog");
const native = require("../mindcloud/native-adapters");
const { validateAdapterInput } = require("../mindcloud/adapter-contracts");

(async () => {
  const html = `<html><head><title>OSINT4ALL</title><meta name="description" content="OSINT toolkit"></head><body><h2>People Search</h2><a href="https://example.org/search">People Search Engine</a><a href="javascript:alert(1)">bad</a><a href="http://insecure.example">insecure</a><a href="https://example.org/search">duplicate</a></body></html>`;
  const parsed = catalogue.parseCatalogue(html);
  assert.equal(parsed.title, "OSINT4ALL");
  assert.equal(parsed.count, 1);
  assert.equal(parsed.tools[0].category, "People Search");
  assert.equal(parsed.tools[0].executionEnabled, false);
  assert.equal(catalogue.searchCatalogue(parsed, "people", 10).count, 1);
  assert.equal(catalogue.searchCatalogue(parsed, "missing", 10).count, 0);

  assert.equal(native.supports("osint4all"), true);
  assert.deepEqual(native.operationsFor("osint4all"), ["refresh", "search"]);
  assert.equal(native.state("osint4all").configured, true);
  assert.equal(validateAdapterInput("osint4all", "refresh", {}).ok, true);
  assert.equal(validateAdapterInput("osint4all", "search", {query:"maps",limit:10}).ok, true);
  assert.equal(validateAdapterInput("osint4all", "search", {query:12}).ok, false);

  const originalFetch = global.fetch;
  try {
    global.fetch = async (url) => {
      assert.equal(String(url), catalogue.DEFAULT_SOURCE_URL);
      return {ok:true,status:200,text:async()=>html};
    };
    const live = await native.execute({id:"osint4all",operation:"search",input:{query:"people"},requestId:"osint-live-test"});
    assert.equal(live.ok,true);
    assert.equal(live.result.count,1);
    assert.equal(live.evidence.sourceName,"OSINT4ALL");
    assert.equal(live.evidence.executionEnabled,false);

    global.fetch = async () => ({ok:false,status:503,text:async()=>"unavailable"});
    const fallback = await native.execute({id:"osint4all",operation:"refresh",input:{},requestId:"osint-fallback-test"});
    assert.equal(fallback.ok,true);
    assert.equal(fallback.result.fallback,true);
    assert.ok(fallback.result.count > 0);
    assert.equal(fallback.evidence.sourceName,"OEFA");
    assert.equal(fallback.evidence.executionEnabled,false);

    const deniedSource = await assert.rejects(() => catalogue.fetchCatalogue("https://example.com/catalog"));
    assert.equal(deniedSource, undefined);
  } finally { global.fetch = originalFetch; }

  const registry = JSON.parse(fs.readFileSync("integrations/agent-tools.json","utf8"));
  assert.ok(registry.tools.some(tool => tool.id === "osint4all"));
  const oefa = JSON.parse(fs.readFileSync("integrations/oefa-registry.json","utf8"));
  assert.ok(oefa.entries.some(entry => entry.id === "overpass-turbo"));
  console.log("osint4all-adapter: parser, typed contracts, read-only discovery, source allowlist and OEFA fallback passed");
})().catch(error => { console.error(error); process.exitCode=1; });
