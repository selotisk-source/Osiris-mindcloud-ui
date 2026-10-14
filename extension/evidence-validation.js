export function validateCctvEvidence({source,response,payload,capturedAt}){
  const checks={
    source:typeof source==="string"&&/^https:\/\//.test(source),
    timestamp:typeof capturedAt==="string"&&!Number.isNaN(Date.parse(capturedAt)),
    httpStatus:Number.isInteger(response?.status)&&response.status>=200&&response.status<300,
    contentType:/application\/json/i.test(response?.headers?.get?.("content-type")||""),
    payload:!!payload&&typeof payload==="object"&&!Array.isArray(payload),
    configured:payload?.status==="configured",
    streamVerified:payload?.streamStatus==="verified",
    proxyVerified:payload?.proxyStatus==="verified",
    frameVerified:payload?.frame?.verified===true&&typeof payload?.frame?.sha256==="string"&&/^[a-f0-9]{64}$/i.test(payload.frame.sha256),
    frameTimestamp:typeof payload?.frame?.capturedAt==="string"&&!Number.isNaN(Date.parse(payload.frame.capturedAt))
  };
  return {valid:Object.values(checks).every(Boolean),checks};
}
