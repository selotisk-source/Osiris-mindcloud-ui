"use strict";

const { createHash } = require("node:crypto");

const SCHEMA = "mindcloud.artifact.v1";
const MAX_CONTENT_BYTES = 1_000_000;
const ALLOWED_MIME_PREFIXES = ["text/", "image/", "application/json", "application/xml", "application/pdf"];

function classify(content, mimeType) {
  const text = String(content || "");
  const mime = String(mimeType || "text/plain").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "document";
  if (/^https?:\/\//im.test(text.trim())) return "link";
  if (/\b(const|let|var|function|import|export|curl|npm|git)\b/.test(text)) return "code-or-command";
  return "text";
}

/**
 * Convert an explicitly selected/exported CopyQ item into a provenance-preserving
 * MindCloud artifact. This function is intentionally local and side-effect free:
 * it does not upload clipboard content or execute commands.
 */
function normalizeCopyQItem(item = {}) {
  const content = typeof item.content === "string" ? item.content : "";
  const mimeType = String(item.mimeType || "text/plain").trim().toLowerCase();
  if (!content.trim()) throw new TypeError("copyq_content_required");
  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) throw new RangeError("copyq_content_too_large");
  if (!ALLOWED_MIME_PREFIXES.some(prefix => mimeType.startsWith(prefix))) throw new TypeError("copyq_mime_type_not_allowed");
  const capturedAt = item.capturedAt ? new Date(item.capturedAt) : new Date();
  if (!Number.isFinite(capturedAt.getTime())) throw new TypeError("copyq_captured_at_invalid");
  const digest = createHash("sha256").update(mimeType).update("\0").update(content, "utf8").digest("hex");
  const sourceItemId = item.sourceItemId == null ? undefined : String(item.sourceItemId).slice(0, 200);
  const sourceApp = item.sourceApp == null ? "CopyQ" : String(item.sourceApp).slice(0, 100);
  return {
    schema: SCHEMA,
    id: "sha256:" + digest,
    content,
    classification: classify(content, mimeType),
    provenance: {
      source: "copyq-local-export",
      sourceApp,
      ...(sourceItemId ? { sourceItemId } : {}),
      capturedAt: capturedAt.toISOString(),
      mimeType,
      contentSha256: digest
    },
    review: { status: "unreviewed", requiresHumanReview: true }
  };
}

module.exports = { SCHEMA, MAX_CONTENT_BYTES, normalizeCopyQItem };
