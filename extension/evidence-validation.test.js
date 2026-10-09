const assert = require("node:assert/strict");
const { DEFAULT_ORIGIN, validateEvidence } = require("./evidence-validation");
const base = {
 evidenceId: "ev-1", source: DEFAULT_ORIGIN + "/api/cctv", capturedAt: "2026-10-09T07:00:00.000Z",
 httpStatus: 200, ok: true, contentType: "application/json; charset=utf-8",
 payload: {service:"osiris-mindcloud-ui",endpoint:"/api/cctv",status:"not_configured",streamStatus:"unconfigured",proxyStatus:"not_implemented"}, streamProof: null
};
assert.equal(validateEvidence(base).responseValid, true);
assert.equal(validateEvidence(base).readyForHumanReview, false);
assert.match(validateEvidence(base).summary, /promotion remains blocked/i);
assert.equal(validateEvidence({...base, source:"https://evil.example/api/cctv"}).responseValid, false);
assert.equal(validateEvidence({...base, source:DEFAULT_ORIGIN+"/api/cctv?admin=1"}).responseValid, false);
assert.equal(validateEvidence({...base, source:"https://user@osiris-mindcloud.up.railway.app/api/cctv"}).responseValid, false);
assert.equal(validateEvidence({...base, contentType:"text/plain"}).responseValid, false);
assert.equal(validateEvidence({...base, httpStatus:503, ok:false}).responseValid, false);
assert.equal(validateEvidence({...base, capturedAt:"not-a-date"}).responseValid, false);
assert.equal(validateEvidence({...base, payload:{...base.payload, service:"other"}}).responseValid, false);
assert.equal(validateEvidence({...base, evidenceId:""}).responseValid, false);
const streamProof = {...base, payload:{...base.payload,status:"configured",streamStatus:"configured",proxyStatus:"implemented"}, streamProof:{verified:true}};
assert.equal(validateEvidence(streamProof).readyForHumanReview, false, "client-supplied verified boolean must never authorize stream readiness");
assert.equal(validateEvidence({...streamProof, streamProof:{verified:true,source:DEFAULT_ORIGIN+"/api/cctv",signature:"forged"}}).readyForHumanReview, false, "untrusted client proof fields must remain blocked");
console.log("evidence-validation tests: 13 assertions passed");
