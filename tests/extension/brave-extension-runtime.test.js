const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

(async () => {
  const braveExecutable = process.env.BRAVE_EXECUTABLE_PATH;
  assert.ok(braveExecutable, "BRAVE_EXECUTABLE_PATH must point to the installed Brave browser");
  assert.ok(fs.existsSync(braveExecutable), "Brave executable does not exist");
  assert.match(path.basename(braveExecutable), /brave-browser/i, "runtime test must launch Brave, not Playwright Chromium");

  const extensionPath = path.resolve(__dirname, "..", "..", "extension");
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, "manifest.json"), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage", "tabs", "sidePanel"]);
  assert.deepEqual(manifest.host_permissions, ["https://mindcloud-live.up.railway.app/*"]);

  const context = await chromium.launchPersistentContext("", {
    executablePath: braveExecutable,
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check"
    ]
  });
  await context.route("https://mindcloud-live.up.railway.app/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/cctv") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "configured",
          snapshotStatus: "verified",
          snapshotContentType: "image/jpeg",
          snapshotByteLength: 64,
          snapshotSha256: "a".repeat(64),
          snapshotCheckedAt: "2026-10-12T04:00:00.000Z",
          streamStatus: "unverified",
          proxyStatus: "implemented",
          frame: { verified: false, sha256: null, capturedAt: null }
        })
      });
    }
    return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Mock MindCloud</title>" });
  });

  let workspaceServer;
  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 });
    assert.match(serviceWorker.url(), /^chrome-extension:\/\//);
    const extensionId = new URL(serviceWorker.url()).hostname;
    const panel = await context.newPage();
    const pageErrors = [];
    panel.on("pageerror", error => pageErrors.push(error.message));
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    assert.equal(await panel.title(), "MindCloud Two-Station Brave Workspace");
    assert.equal(await panel.locator("header").innerText(), "MINDCLOUD · TWO-STATION BRAVE WORKSPACE");
    assert.equal(await panel.locator(".station").count(), 2);
    assert.equal(await panel.locator("#open").innerText(), "Open MindCloud");
    assert.equal(await panel.locator("#probe").innerText(), "Probe OSIRIS CCTV (read-only)");
    assert.equal(await panel.locator("#inspectTab").innerText(), "Inspect active-tab metadata");
    assert.equal(await panel.locator("#promotionGate").innerText(), "BLOCKED — no validated response or stream proof.");
    assert.equal(await panel.locator("script:not([src])").evaluateAll(nodes => nodes.filter(node => node.textContent.trim()).length), 0);

    // Exercise the real button handlers with a controlled, snapshot-only API response.
    await panel.locator("#probe").click();
    await panel.getByText("Snapshot record validated.").waitFor();
    assert.match(await panel.locator("#promotionGate").innerText(), /^BLOCKED — live-stream\/proxy\/frame proof is incomplete/);
    const validation = JSON.parse(await panel.locator("#verification").innerText());
    assert.equal(validation.validation.snapshotRecordValid, true);
    assert.equal(validation.validation.promotionReady, false);
    assert.equal(validation.evidence.streamProof, null);

    const openedPagePromise = context.waitForEvent("page");
    await panel.locator("#open").click();
    const openedPage = await openedPagePromise;
    await openedPage.waitForLoadState("domcontentloaded");
    assert.equal(openedPage.url(), "https://mindcloud-live.up.railway.app/");

    // Keep a normal HTTP tab active, then exercise the metadata handler without
    // bringing the extension page to the foreground. This mirrors a real side panel.
    const targetPage = await context.newPage();
    await targetPage.goto("https://mindcloud-live.up.railway.app/mock-active-tab");
    await targetPage.bringToFront();
    await panel.evaluate(() => document.getElementById("inspectTab").click());
    await panel.waitForFunction(() => document.getElementById("tabMetadata").textContent.includes('"cookiesRead": false'));
    const tabMetadata = JSON.parse(await panel.locator("#tabMetadata").innerText());
    assert.equal(tabMetadata.title, "Mock MindCloud");
    assert.equal(tabMetadata.url, "https://mindcloud-live.up.railway.app/mock-active-tab");
    assert.equal(tabMetadata.origin, "https://mindcloud-live.up.railway.app");
    assert.equal(tabMetadata.cookiesRead, false);
    assert.equal(tabMetadata.pageContentRead, false);
    assert.equal(tabMetadata.networkTransfer, false);

    // Open the actual MindCloud index.html in Brave and exercise the real layout controls.
    const workspacePage = await context.newPage();
    const workspaceHtml = fs.readFileSync(path.resolve(__dirname, "..", "..", "index.html"), "utf8");
    workspaceServer = http.createServer((req, res) => {
      if (req.url === "/" || req.url.startsWith("/?")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(workspaceHtml);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    await new Promise((resolve, reject) => {
      workspaceServer.once("error", reject);
      workspaceServer.listen(0, "127.0.0.1", resolve);
    });
    const workspaceUrl = `http://127.0.0.1:${workspaceServer.address().port}/`;
    await workspacePage.goto(workspaceUrl, { waitUntil: "domcontentloaded" });
    await workspacePage.waitForFunction(() => document.querySelector(".workspace")?.dataset.layoutMode === "2");
    assert.match(await workspacePage.locator("#workspaceStatus").innerText(), /two-station workspace/);
    assert.deepEqual(
      await workspacePage.locator(".station").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display !== "none")),
      [true, false, false, true]
    );
    assert.equal(await workspacePage.locator("#osirisFrame").count(), 0, "OSIRIS must use the standalone launcher while cross-origin framing is blocked");

    // OSIRIS configures X-Frame-Options: SAMEORIGIN, so verify the explicit standalone launch path.
    assert.equal(await workspacePage.locator("#osirisLaunchTitle").innerText(), "Open OSIRIS as a separate platform");
    assert.match(await workspacePage.locator("#osirisEmbedStatus").innerText(), /restricts cross-origin framing/);
    const osirisOpen = workspacePage.locator("#osirisOpenStandalone");
    assert.equal(await osirisOpen.getAttribute("href"), "https://osirisai.live/");
    assert.equal(await osirisOpen.getAttribute("target"), "_blank");
    assert.equal(await osirisOpen.getAttribute("rel"), "noopener noreferrer");
    assert.equal(await workspacePage.locator("#osirisOpenHere").getAttribute("target"), "_self");
    await workspacePage.locator('[data-layout="4"]').click();
    await workspacePage.waitForFunction(() => document.querySelector(".workspace")?.dataset.layoutMode === "4");
    assert.deepEqual(
      await workspacePage.locator(".station").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display !== "none")),
      [true, true, true, true]
    );
    await workspacePage.locator('[data-layout="2"]').click();
    await workspacePage.waitForFunction(() => document.querySelector(".workspace")?.dataset.layoutMode === "2");
    assert.deepEqual(
      await workspacePage.locator(".station").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display !== "none")),
      [true, false, false, true]
    );

    assert.deepEqual(pageErrors, []);
    console.log(`brave-runtime: PASS — extension ${extensionId}; two-station layout and secure OSIRIS standalone launcher verified in Brave; four-station switch and return`);
  } finally {
    await context.close();
    if (workspaceServer) await new Promise(resolve => workspaceServer.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
