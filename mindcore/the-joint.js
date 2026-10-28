"use strict";

function invalid(code) { const error = new Error(code); error.code = code; error.statusCode = 400; return error; }
function normalizeText(value) { return value.normalize("NFKC").toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, " ").trim(); }
function normalizePartial(partial, slot) {
  if (!partial || typeof partial !== "object" || Array.isArray(partial) || typeof partial.id !== "string" || !partial.id.trim() || !Array.isArray(partial.claims)) throw invalid("the_joint_partial_invalid_" + slot);
  const ids = new Set();
  const claims = partial.claims.map((claim, index) => {
    if (!claim || typeof claim !== "object" || Array.isArray(claim) || typeof claim.id !== "string" || !claim.id.trim() || typeof claim.text !== "string" || !claim.text.trim()) throw invalid("the_joint_claim_invalid_" + slot + "_" + index);
    if (ids.has(claim.id)) throw invalid("the_joint_claim_id_duplicate_" + slot);
    ids.add(claim.id);
    const refs = claim.evidenceRefs === undefined ? [] : claim.evidenceRefs;
    if (!Array.isArray(refs) || refs.some(ref => typeof ref !== "string" || !ref.trim())) throw invalid("the_joint_evidence_refs_invalid_" + slot + "_" + claim.id);
    return {id:claim.id.trim(),text:claim.text.trim(),key:normalizeText(claim.text),subject:typeof claim.subject === "string" ? normalizeText(claim.subject) : "",polarity:["positive","negative"].includes(claim.polarity) ? claim.polarity : "unspecified",evidenceRefs:[...new Set(refs.map(ref=>ref.trim()))].sort(),declaredStatus:typeof claim.status === "string" ? claim.status : "unknown"};
  });
  return {id:partial.id.trim(),summary:typeof partial.summary === "string" ? partial.summary.trim() : "",claims};
}
function createJoint(input = {}) {
  const left = normalizePartial(input.left,"left"); const right = normalizePartial(input.right,"right");
  if (left.id === right.id) throw invalid("the_joint_partials_must_be_distinct");
  const rightByKey = new Map();
  for (const claim of right.claims) { if (!rightByKey.has(claim.key)) rightByKey.set(claim.key,[]); rightByKey.get(claim.key).push(claim); }
  const matchedRight = new Set(); const shared = []; const leftOnly = []; const tensions = [];
  for (const a of left.claims) {
    const match = a.key ? (rightByKey.get(a.key)||[]).find(b=>!matchedRight.has(b.id)) : null;
    if (match) { matchedRight.add(match.id); shared.push({claimText:a.text,leftClaimId:a.id,rightClaimId:match.id,evidenceRefs:[...new Set([...a.evidenceRefs,...match.evidenceRefs])].sort(),status:"shared_wording_match",independentlyValidated:false}); continue; }
    const opposite = a.subject && a.polarity !== "unspecified" ? right.claims.filter(b=>b.subject===a.subject && b.polarity!=="unspecified" && b.polarity!==a.polarity) : [];
    for (const b of opposite) tensions.push({subject:a.subject,left:{partialId:left.id,claimId:a.id,text:a.text,polarity:a.polarity,evidenceRefs:a.evidenceRefs},right:{partialId:right.id,claimId:b.id,text:b.text,polarity:b.polarity,evidenceRefs:b.evidenceRefs},resolution:"unresolved",requiresReview:true});
    leftOnly.push({partialId:left.id,claimId:a.id,text:a.text,evidenceRefs:a.evidenceRefs,status:"unique_to_partial"});
  }
  const rightOnly = right.claims.filter(claim=>!matchedRight.has(claim.id)).map(claim=>({partialId:right.id,claimId:claim.id,text:claim.text,evidenceRefs:claim.evidenceRefs,status:"unique_to_partial"}));
  const evidenceRefs = [...new Set([...left.claims,...right.claims].flatMap(claim=>claim.evidenceRefs))].sort();
  return {type:"mindcloud_joint_synthesis",schemaVersion:1,jointId:"joint:"+[left.id,right.id].sort().join("+"),inputs:[{id:left.id,summary:left.summary,claimCount:left.claims.length},{id:right.id,summary:right.summary,claimCount:right.claims.length}],synthesis:{summary:"Combined view of two partial syntheses; shared claims, unique claims and unresolved tensions are retained separately.",shared,leftOnly,rightOnly,tensions,counts:{shared:shared.length,leftOnly:leftOnly.length,rightOnly:rightOnly.length,unresolvedTensions:tensions.length}},provenance:{evidenceRefs,sourcePartialIds:[left.id,right.id],allClaimsRetainSourceIds:true},status:tensions.length?"needs_reconciliation":"joined_pending_validation",independentlyValidated:false,note:"Exact wording matches are not proof of truth. Opposing claims remain unresolved; this deterministic join does not perform semantic inference or auto-resolve contradictions."};
}
module.exports = {createJoint,normalizeText};