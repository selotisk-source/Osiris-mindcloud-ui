const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const extensionPath = path.resolve(__dirname, "..", "extension");
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionPath, "manifest.json"), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage", "tabs", "sidePanel"]);
  assert.deepEqual(manifest.host_permissions, ["https://mindcloud-live.up.railway.app/*"]);

  const context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 10000 });
    }
    assert.match(serviceWorker.url(), /^chrome-extension:\/\//);

    const extensionId = new URL(serviceWorker.url()).hostname;
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    assert.equal(await panel.title(), "MindCloud Two-Station Brave Workspace");
    assert.equal(await panel.locator("header").innerText(), "MINDCLOUD · TWO-STATION BRAVE WORKSPACE");
    assert.equal(await panel.locator("#open").innerText(), "Open MindCloud");
    assert.equal(await panel.locator("#probe").innerText(), "Probe OSIRIS CCTV (read-only)");
    assert.equal(await panel.locator("#inspectTab").innerText(), "Inspect active-tab metadata");

    const csp = await panel.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.content || null;
    });
    assert.equal(csp, null);

    await panel.locator("#inspectTab").click();
    await assert.doesNotReject(async () => {
      await panel.locator("#tabMetadata").waitFor({ state: "visible", timeout: 2000 });
    });

    console.log(`brave-extension: PASS — loaded ${extensionId}, service worker active, side panel rendered, controls present, no inline CSP dependency`);
  } finally {
    await context.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
