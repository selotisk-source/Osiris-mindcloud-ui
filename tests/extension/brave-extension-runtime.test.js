const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
    assert.deepEqual(pageErrors, []);
    console.log(`brave-extension: PASS — extension ${extensionId}; service worker active; two stations rendered; no inline scripts or page errors`);
  } finally {
    await context.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
