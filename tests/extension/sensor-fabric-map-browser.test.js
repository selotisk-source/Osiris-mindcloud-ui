const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const braveExecutable = process.env.BRAVE_EXECUTABLE_PATH;
  assert.ok(braveExecutable, "BRAVE_EXECUTABLE_PATH must point to Brave");
  assert.ok(fs.existsSync(braveExecutable), "Brave executable does not exist");
  assert.match(path.basename(braveExecutable), /brave-browser/i, "test must use Brave, not bundled Chromium");

  const html = fs.readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
  const cctv = {
    status: "configured",
    streamStatus: "unverified",
    streamProtocol: "HLS",
    proxyStatus: "verified",
    proxyAuthStatus: "configured",
    frameStatus: "unverified",
    evidenceStatus: "snapshot-verified",
    access: "protected"
  };
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url?.startsWith("/?")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    if (req.url?.startsWith("/api/cctv")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(cctv));
      return;
    }
    if (req.url?.startsWith("/api/")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(204);
    res.end();
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({
    executablePath: braveExecutable,
    headless: false,
    args: ["--no-first-run", "--no-default-browser-check"]
  });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
  const tileUrl = /^https:\/\/[abc]\.tile\.openstreetmap\.org\//;
  try {
    const successPage = await browser.newPage();
    const successErrors = [];
    let tileRequests = 0;
    successPage.on("pageerror", error => successErrors.push(error.message));
    await successPage.route(tileUrl, async route => {
      tileRequests++;
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ status: 200, contentType: "image/png", body: png });
    });
    await successPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await successPage.waitForFunction(() => !!window.L, null, { timeout: 20000 });
    await successPage.locator('[data-module="Sensor Fabric"]').click();
    await successPage.locator("#sensorFabricMap").waitFor({ state: "visible" });
    await successPage.waitForFunction(
      () => document.getElementById("sensorMapStatus")?.textContent.includes("waiting for map tiles"),
      null,
      { timeout: 10000 }
    );
    assert.doesNotMatch(await successPage.locator("#sensorMapStatus").innerText(), /Map ready/);
    await successPage.waitForFunction(
      () => document.getElementById("sensorMapStatus")?.textContent.includes("Map tiles loaded"),
      null,
      { timeout: 20000 }
    );
    assert.ok(tileRequests > 0, "map must request OpenStreetMap tiles");
    await successPage.locator("#sensorMapSofia").click();
    await successPage.locator("#sensorMapWorld").click();
    assert.deepEqual(successErrors, [], "successful map interaction must not throw page errors");

    const failurePage = await browser.newPage();
    const failureErrors = [];
    failurePage.on("pageerror", error => failureErrors.push(error.message));
    await failurePage.route(tileUrl, route => route.abort());
    await failurePage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await failurePage.waitForFunction(() => !!window.L, null, { timeout: 20000 });
    await failurePage.locator('[data-module="Sensor Fabric"]').click();
    await failurePage.locator("#sensorFabricMap").waitFor({ state: "visible" });
    await failurePage.waitForFunction(
      () => document.getElementById("sensorMapStatus")?.textContent.includes("map tiles could not be fetched"),
      null,
      { timeout: 20000 }
    );
    assert.deepEqual(failureErrors, [], "tile failures must degrade gracefully without page errors");
    console.log("sensor-fabric-map-browser: PASS — Brave loaded the real app and Leaflet, verified waiting/success/failure tile states, and exercised Sofia/world controls with tile responses isolated");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
