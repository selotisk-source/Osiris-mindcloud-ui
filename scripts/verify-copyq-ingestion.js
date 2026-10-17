"use strict";

const assert = require("node:assert/strict");
const { SCHEMA, normalizeCopyQItem } = require("../mindcloud/copyq-ingestion");

const item = normalizeCopyQItem({
  content: "https://example.org/research",
  mimeType: "text/plain",
  sourceItemId: "42",
  sourceApp: "CopyQ",
  capturedAt: "2026-10-17T10:00:00.000Z"
});
assert.equal(item.schema, SCHEMA);
assert.equal(item.classification, "link");
assert.equal(item.provenance.source, "copyq-local-export");
assert.equal(item.provenance.sourceItemId, "42");
assert.equal(item.provenance.capturedAt, "2026-10-17T10:00:00.000Z");
assert.match(item.provenance.contentSha256, /^[a-f0-9]{64}$/);
assert.equal(item.id, "sha256:" + item.provenance.contentSha256);
assert.equal(item.review.status, "unreviewed");
assert.equal(item.review.requiresHumanReview, true);

const same = normalizeCopyQItem({ content: "https://example.org/research", mimeType: "text/plain", capturedAt: "2026-10-17T10:00:00Z" });
assert.equal(same.id, item.id, "same MIME type and content must yield a stable content ID");
assert.throws(() => normalizeCopyQItem({ content: "  ", mimeType: "text/plain" }), /copyq_content_required/);
assert.throws(() => normalizeCopyQItem({ content: "x", mimeType: "application/x-executable" }), /copyq_mime_type_not_allowed/);
assert.throws(() => normalizeCopyQItem({ content: "x", mimeType: "text/plain", capturedAt: "not-a-date" }), /copyq_captured_at_invalid/);
assert.throws(() => normalizeCopyQItem({ content: "x".repeat(1_000_001), mimeType: "text/plain" }), /copyq_content_too_large/);

console.log("copyq-ingestion: normalization, stable SHA-256 identity, provenance, review gate and rejection cases passed");
