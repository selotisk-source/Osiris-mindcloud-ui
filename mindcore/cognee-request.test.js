const assert = require("node:assert/strict");
const { createRequestInit } = require("./cognee-request.js");

const form = new FormData();
form.append("data", "memory");
const multipart = createRequestInit({
  method: "POST",
  body: form,
  headers: { "content-type": "application/json", "x-test": "preserved" }
});
const multipartHeaders = new Headers(multipart.headers);
assert.equal(multipart.body, form);
assert.equal(multipartHeaders.has("content-type"), false);
assert.equal(multipartHeaders.get("x-test"), "preserved");

const json = createRequestInit({ method: "POST", body: JSON.stringify({ query: "test" }) });
assert.equal(new Headers(json.headers).get("content-type"), "application/json");

const explicit = createRequestInit({ method: "POST", body: "text", headers: { "content-type": "text/plain" } });
assert.equal(new Headers(explicit.headers).get("content-type"), "text/plain");

console.log("Cognee request header tests: 5 assertions passed");
