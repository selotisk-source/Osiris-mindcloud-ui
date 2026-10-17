#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { captureDecodedFrame } = require("../mindcloud/cctv-frame-capture");

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mindcloud-frame-test-"));
  const fakeFfmpeg = path.join(dir, "fake-ffmpeg.js");
  const validJpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
  try {
    fs.writeFileSync(fakeFfmpeg, [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "const mode = process.env.FAKE_FFMPEG_MODE || 'valid';",
      "process.stdout.write(Buffer.from(mode === 'valid' ? '" + validJpeg.toString("hex") + "' : 'not-an-image', 'hex'));",
      "process.exitCode = mode === 'valid' ? 0 : 1;"
    ].join("\n"));
    fs.chmodSync(fakeFfmpeg, 0o755);

    const noBinary = await captureDecodedFrame({ sourceUrl: "https://camera.example/live.m3u8" });
    assert.equal(noBinary.status, "unavailable");
    assert.equal(noBinary.error, "ffmpeg_binary_not_configured");

    const insecure = await captureDecodedFrame({ ffmpegPath: fakeFfmpeg, sourceUrl: "http://127.0.0.1/live.m3u8" });
    assert.equal(insecure.status, "rejected");

    const decoded = await captureDecodedFrame({ ffmpegPath: fakeFfmpeg, sourceUrl: "https://camera.example/live.m3u8" });
    assert.equal(decoded.status, "decoded");
    assert.equal(decoded.verified, true);
    assert.equal(decoded.mediaType, "image/jpeg");
    assert.equal(decoded.byteLength, validJpeg.length);
    assert.match(decoded.sha256, /^[a-f0-9]{64}$/);
    assert.ok(decoded.capturedAt);
    assert.equal(Buffer.from(decoded.frameBase64, "base64").compare(validJpeg), 0);

    const failedScript = path.join(dir, "fake-ffmpeg-fail.js");
    fs.writeFileSync(failedScript, "#!/usr/bin/env node\nprocess.stdout.write('not-a-frame'); process.exitCode = 1;\n");
    fs.chmodSync(failedScript, 0o755);
    const failed = await captureDecodedFrame({ ffmpegPath: failedScript, sourceUrl: "https://camera.example/live.m3u8" });
    assert.equal(failed.status, "failed");
    assert.equal(failed.verified, undefined);
    assert.equal(failed.error, "frame_decode_failed");

    console.log(JSON.stringify({
      status: "verified",
      checks: [
        "missing-decoder-is-not-verified",
        "insecure-source-rejected",
        "successful-decoder-output-hashed",
        "invalid-decoder-output-never-verified"
      ]
    }, null, 2));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
