"use strict";

// A bounded, fail-closed FFmpeg capture helper. It returns a frame only when
// FFmpeg successfully decodes one; transport success or JPEG magic bytes alone
// never count as decoded-frame evidence.
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 12000;

function captureDecodedFrame({ ffmpegPath, sourceUrl, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} }) {
  if (!ffmpegPath || typeof ffmpegPath !== "string") {
    return Promise.resolve({ status: "unavailable", error: "ffmpeg_binary_not_configured" });
  }
  if (typeof sourceUrl !== "string" || !/^https:\/\//i.test(sourceUrl)) {
    return Promise.resolve({ status: "rejected", error: "https_source_required" });
  }
  const boundedTimeout = Math.max(1000, Math.min(20000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  const headerLines = Object.entries(headers)
    .filter(([key, value]) => /^[a-z0-9-]{1,64}$/i.test(key) && typeof value === "string" && !/[\r\n]/.test(value))
    .map(([key, value]) => key + ": " + value + "\r\n")
    .join("");

  return new Promise(resolve => {
    let settled = false;
    let stderr = "";
    let total = 0;
    const chunks = [];
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    let child;
    try {
      child = spawn(ffmpegPath, [
        "-nostdin", "-hide_banner", "-loglevel", "error",
        "-headers", headerLines,
        "-i", sourceUrl,
        "-map", "0:v:0", "-frames:v", "1",
        "-an", "-sn", "-dn",
        "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"
      ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch (error) {
      finish({ status: "failed", error: "ffmpeg_spawn_failed", detail: error.message });
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ status: "failed", error: "frame_decode_timeout" });
    }, boundedTimeout);
    child.stdout.on("data", chunk => {
      total += chunk.length;
      if (total > MAX_FRAME_BYTES) {
        child.kill("SIGKILL");
        finish({ status: "failed", error: "decoded_frame_too_large" });
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString("utf8")).slice(-2000); });
    child.once("error", error => finish({ status: "failed", error: "ffmpeg_process_error", detail: error.message }));
    child.once("close", (code, signal) => {
      if (settled) return;
      const frame = Buffer.concat(chunks);
      const validJpeg = frame.length >= 4 && frame[0] === 0xff && frame[1] === 0xd8 &&
        frame[frame.length - 2] === 0xff && frame[frame.length - 1] === 0xd9;
      if (code !== 0 || !validJpeg) {
        finish({ status: "failed", error: "frame_decode_failed", exitCode: code, signal, detail: stderr || null });
        return;
      }
      const capturedAt = new Date().toISOString();
      finish({
        status: "decoded",
        verified: true,
        mediaType: "image/jpeg",
        byteLength: frame.length,
        sha256: crypto.createHash("sha256").update(frame).digest("hex"),
        capturedAt,
        frameBase64: frame.toString("base64")
      });
    });
  });
}

module.exports = { captureDecodedFrame, MAX_FRAME_BYTES, DEFAULT_TIMEOUT_MS };
