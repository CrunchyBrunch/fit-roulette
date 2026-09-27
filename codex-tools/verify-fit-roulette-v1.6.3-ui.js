const assert = require("assert/strict");
const fs = require("fs");
const { loadPlaywright, browserExecutable, serve, fixture, item, freshPage } = require("./verify-fit-roulette-v1.6.2-ui.js");

async function storage(page) {
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((key) => key.startsWith("fitRoulette.v1")).sort().map((key) => [key, localStorage.getItem(key)])));
}
async function select(page, id) {
  const name = await page.evaluate((id) => window.__fitRouletteTest.getState().wardrobe.find((item) => item.id === id).name, id);
  await page.locator("#manualItemSearch").fill(name);
  await page.locator(`input[name='manualItem'][value='${id}']`).check();
}
async function selected(page) { return page.evaluate(() => window.__fitRouletteTest.getManualSelectedItemIds()); }

async function verifyPresentation(browser, url, options) {
  const { context, page, issues, externalRequests } = await freshPage(browser, url, options);
  try {
    if (options.enlargedText) await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });
    const before = await storage(page);
    for (const screen of ["generate", "closet", "history", "insights", "settings"]) {
      await page.locator(`[data-screen='${screen}']`).click();
      assert.equal(await page.getByRole("button", { name: "Add item", exact: true }).count(), 1);
      await page.locator("#quickAddBtn").click();
      assert.equal(await page.locator("#screen-closet").isVisible(), true);
      await page.locator("#closeItemDialogBtn").click();
      assert.equal(await page.locator("#quickAddBtn").evaluate((node) => node === document.activeElement), true);
    }
    await page.locator("#closetSearch").fill("Current Renamed");
    const idsBefore = await page.locator(".closet-card[data-item-id]").evaluateAll((nodes) => nodes.map((node) => node.dataset.itemId));
    await page.locator("#closetDensityBtn").click();
    assert.equal(await page.locator("#closetDensityBtn").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#closetSearch").inputValue(), "Current Renamed");
    assert.deepEqual(await page.locator(".closet-card[data-item-id]").evaluateAll((nodes) => nodes.map((node) => node.dataset.itemId)), idsBefore);
    await page.locator("#closetDensityBtn").click();
    assert.equal(await page.locator("#closetDensityBtn").getAttribute("aria-pressed"), "false");
    const filters = page.locator("#closetFilterDetails > summary");
    await filters.focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator("#closetFilterDetails").evaluate((node) => node.open), true);
    await page.locator("#closetStatus").selectOption("all");
    assert.equal(await page.locator("#closetFilterCount").textContent(), "1 active");
    await filters.click();
    assert.equal(await page.locator("#closetFilterDetails").evaluate((node) => node.open), false);
    await filters.click(); await page.locator("#clearClosetFiltersBtn").click();
    assert.equal(await page.locator("#closetFilterCount").textContent(), "0 active");
    assert.equal(await page.locator(".closet-card .garment-tile").count(), 5);
    assert.equal(await page.locator(".garment-tile:not([aria-hidden='true'])").count(), 0);
    assert.match(await page.locator("[data-item-id='layer']").textContent(), /Plum Smoke|Custom Plum/);

    await page.locator("[data-screen='history']").click();
    await page.locator("#manualLogHistoryBtn").click();
    assert.equal(await page.locator("#manualLogDialogTitle").evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.locator("#manualLogDialogTitle").evaluate((node) => getComputedStyle(node).outlineStyle), "none");
    const bounds = await page.locator("#manualLogDate").evaluate((node) => {
      const box = (element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, scroll: element.scrollWidth, client: element.clientWidth }; };
      return { input: box(node), field: box(node.closest("label")), grid: box(node.closest(".two-column")), form: box(node.closest("form")), dialog: box(node.closest("dialog")), viewport: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth, appearance: getComputedStyle(node).appearance };
    });
    for (const name of ["field", "grid", "form", "dialog"]) {
      assert(bounds.input.left >= bounds[name].left - 1 && bounds.input.right <= bounds[name].right + 1, `Date escaped ${name}: ${JSON.stringify(bounds)}`);
      assert(bounds[name].scroll <= bounds[name].client + 1, `${name} overflowed: ${JSON.stringify(bounds)}`);
    }
    assert(bounds.dialog.left >= 0 && bounds.dialog.right <= bounds.viewport + 1);
    assert(bounds.pageScroll <= bounds.viewport + 1);
    assert.notEqual(bounds.appearance, "none");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#manualLogHistoryBtn").evaluate((node) => document.activeElement === node), true);
    await page.locator("#manualLogHistoryBtn").focus(); await page.keyboard.press("Enter");
    assert.notEqual(await page.locator("#manualLogDialogTitle").evaluate((node) => getComputedStyle(node).outlineStyle), "none");
    await page.locator("#manualLogNote").fill("Unsaved note");
    await page.locator("#closeManualLogBtn").click();
    await page.locator("#continueHistoryExitBtn").click();
    assert.equal(await page.locator("#closeManualLogBtn").evaluate((node) => document.activeElement === node), true);
    await page.locator("#closeManualLogBtn").click(); await page.locator("#discardHistoryExitBtn").click();
    assert.equal(await page.locator("#manualLogHistoryBtn").evaluate((node) => document.activeElement === node), true);

    const edit = page.locator("[data-log-id='log-generated'] [data-action='edit-log']");
    await edit.click();
    assert.equal(await page.locator("#manualLogDialogTitle").evaluate((node) => getComputedStyle(node).outlineStyle), "none");
    await page.keyboard.press("Escape");
    assert.equal(await edit.evaluate((node) => document.activeElement === node), true);
    await edit.focus(); await page.keyboard.press("Enter");
    assert.notEqual(await page.locator("#manualLogDialogTitle").evaluate((node) => getComputedStyle(node).outlineStyle), "none");
    await page.keyboard.press("Escape");

    await page.locator("[data-screen='generate']").click();
    await page.locator("#occasionSelect").selectOption("casual");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const pending = await page.evaluate(async () => {
      const api = window.__fitRouletteTest;
      const first = api.generateAndRender(); const second = api.generateAndRender();
      const node = document.querySelector("#generationStatus");
      const result = { deduplicated: first === second, active: node.classList.contains("is-pending"), announcement: node.textContent, reducedAnimation: getComputedStyle(node, "::before").animationName };
      await first;
      return { ...result, complete: !node.classList.contains("is-pending") };
    });
    assert.equal(pending.deduplicated, true); assert.equal(pending.active, true); assert.equal(pending.complete, true);
    assert.match(pending.announcement, /Building your fit/); assert.equal(pending.reducedAnimation, "none");
    assert((await page.locator(".result-item .garment-tile").count()) >= 3);
    const runtimeBefore = await page.evaluate(() => JSON.stringify([window.__fitRouletteTest.getState(), window.__fitRouletteTest.getCurrentOutfit(), window.__fitRouletteTest.getRerollSession()]));
    await page.locator("[data-screen='insights']").click();
    assert.equal(await page.getByRole("heading", { name: "What your logs include", exact: true }).count(), 1);
    await page.locator(".insights-disclosure").nth(2).locator("summary").first().click();
    await page.locator("#insightsRangeSelect").selectOption("30");
    await page.locator("#runCoverageBtn").click(); await page.locator("#coverageStatus").filter({ hasText: /complete/ }).waitFor();
    await page.locator("#runEvaluationBtn").click(); await page.locator("#evaluationStatus").filter({ hasText: /complete/ }).waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify([window.__fitRouletteTest.getState(), window.__fitRouletteTest.getCurrentOutfit(), window.__fitRouletteTest.getRerollSession()])), runtimeBefore);
    assert.deepEqual(await storage(page), before);
    assert.deepEqual(externalRequests, []); assert.deepEqual(issues, []);
    assert.equal(await page.evaluate(() => window.__locationRequests), 0);
    return { ...options, focus: "pointer/keyboard/exit", dateBounds: "field/grid/form/dialog/viewport", overflow: 0, readOnly: true, reducedMotion: true };
  } finally { await context.close(); }
}

async function verifyHistoryGuardrails(browser, url) {
  const state = fixture();
  state.wardrobe.push(item("sweater", "top", { name: "sweater", subtype: "sweater", layerRoles: ["base", "mid"] }));
  state.wardrobe.push(item("replacement", "top", { name: "replacement" }));
  state.history[0].itemIds.push("top-two");
  state.history[0].itemSnapshots.push({ ...state.wardrobe[1] });
  const { context, page, issues } = await freshPage(browser, url, { state });
  try {
    const before = await storage(page);
    await page.evaluate(() => {
      window.__writes = 0;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === "fitRoulette.v1") window.__writes++; return set.call(this, key, value); };
    });
    await page.locator("[data-screen='history']").click();
    const original = await page.evaluate(() => JSON.parse(JSON.stringify(window.__fitRouletteTest.getState().history[0])));
    const edit = page.locator("[data-log-id='log-generated'] [data-action='edit-log']");
    await edit.click(); assert.equal(await page.locator("#manualSlotNotice").isVisible(), true);
    assert.deepEqual(await storage(page), before);
    await page.locator("#manualLogNote").fill("Note only preserves anomalies");
    await page.locator("#manualLogSubmitBtn").click();
    const updated = await page.evaluate(() => window.__fitRouletteTest.getState().history.find((record) => record.id === "log-generated"));
    assert.deepEqual(updated, { ...original, note: "Note only preserves anomalies" });
    assert.equal(await page.evaluate(() => window.__writes), 1);
    assert.equal(await edit.evaluate((node) => node === document.activeElement), true);
    await edit.click(); await page.locator("#manualLogDate").fill("2026-09-02"); await page.locator("#manualLogSubmitBtn").click();
    const dated = await page.evaluate(() => window.__fitRouletteTest.getState().history.find((record) => record.id === "log-generated"));
    assert.deepEqual(dated.itemIds, original.itemIds); assert.deepEqual(dated.itemSnapshots, original.itemSnapshots);
    assert.equal(dated.context, null); assert.equal(dated.source, original.source);
    await edit.click(); await select(page, "replacement");
    assert(!(await selected(page)).includes("top-one") && !(await selected(page)).includes("top-two"));
    assert((await selected(page)).includes("missing-item"));
    assert.match(await page.locator("#manualSlotStatus").textContent(), /replaced/);
    await page.locator("#closeManualLogBtn").click(); await page.locator("#discardHistoryExitBtn").click();
    assert.deepEqual(await page.evaluate(() => window.__fitRouletteTest.getState().history.find((record) => record.id === "log-generated")), dated);
    assert.equal(await page.evaluate(() => window.__writes), 2);

    await page.locator("#manualLogHistoryBtn").click();
    await select(page, "top-one"); await select(page, "top-two");
    assert.deepEqual(await selected(page), ["top-two"]);
    await select(page, "sweater"); assert.deepEqual(await selected(page), ["top-two", "sweater"]);
    await select(page, "layer"); assert.deepEqual(await selected(page), ["top-two", "layer"]);
    await page.locator("#manualLogSubmitBtn").click();
    assert.equal(await page.evaluate(() => window.__writes), 3);
    assert.equal(await page.locator("#manualLogHistoryBtn").evaluate((node) => node === document.activeElement), true);
    const after = await storage(page);
    for (const key of Object.keys(before).filter((key) => key.includes("recovery"))) assert.equal(after[key], before[key]);
    assert.deepEqual(issues, []);
    return { legacyNoteAndDatePreserveEvidence: true, slotReplacement: true, basePlusLayer: true, successfulWrites: 3, discardWrites: 0, recoveryByteEquivalent: true };
  } finally { await context.close(); }
}

async function verifyDisplayAndOffline(browser, url) {
  const state = fixture();
  state.wardrobe[0].labels = ["Synthetic favorite"];
  state.wardrobe[0].review = { status: "needs_review", reasons: ["Check imported details."], reviewedAt: "" };
  const context = await browser.newContext({ viewport: { width: 359, height: 900 } });
  try {
    // Seed exactly once: reload must preserve actual bytes, not recreate a fixture.
    await context.addInitScript((payload) => {
      if (!localStorage.getItem("fitRoulette.v1")) {
        localStorage.setItem("fitRoulette.v1", payload);
        for (const suffix of ["schema4", "schema5", "schema5.import.synthetic"]) localStorage.setItem(`fitRoulette.v1.recovery.${suffix}`, `synthetic-${suffix}`);
      }
      window.__FIT_ROULETTE_TESTING__ = true;
      window.__FIT_ROULETTE_NOW__ = () => new Date("2026-09-03T12:00:00-04:00").getTime();
      window.__locationRequests = 0;
      navigator.geolocation.getCurrentPosition = () => { window.__locationRequests++; };
    }, JSON.stringify(state));
    const page = await context.newPage();
    const issues = [], externalRequests = [];
    page.on("console", (message) => { if (["warning", "error"].includes(message.type())) issues.push(message.text()); });
    page.on("pageerror", (error) => issues.push(error.message));
    page.on("request", (request) => { if (!request.url().startsWith(url)) externalRequests.push(request.url()); });
    await page.goto(url);
    const before = await storage(page);
    await page.locator("[data-screen='closet']").click();
    assert.match(await page.locator("[data-item-id='top-one']").innerText(), /Needs review/i);
    assert.equal(await page.locator(".closet-optional-detail:visible").count(), 0);
    await page.locator("#closetDensityBtn").click();
    assert((await page.locator(".closet-optional-detail:visible").count()) > 0);
    await page.locator("#closetFilterDetails > summary").click();
    await page.locator("#closetStatus").selectOption("all");
    assert.match(await page.locator("[data-item-id='unavailable']").innerText(), /Unavailable/);
    const tile = await page.evaluate(() => {
      const render = window.__fitRouletteTest.renderGarmentTile;
      return { missing: render(), unknown: render({ category: "unknown", primaryColor: "Mystery shade" }), pattern: render({ category: "top", primaryColor: "Navy", pattern: "striped" }) };
    });
    assert.match(tile.missing, /title="Garment"/); assert.match(tile.missing, /color-swatch-custom/);
    assert.match(tile.unknown, /M5 4h10v12H5z/); assert.match(tile.unknown, /color-swatch-custom/);
    assert.match(tile.pattern, /pattern-striped/); assert.match(tile.pattern, /≋/);
    await page.locator("[data-screen='generate']").click();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const animation = await page.evaluate(async () => {
      const pending = window.__fitRouletteTest.generateAndRender();
      const name = getComputedStyle(document.querySelector("#generationStatus"), "::before").animationName;
      await pending; return name;
    });
    assert.equal(animation, "generation-pulse");
    await page.locator("[data-screen='insights']").click();
    await page.locator(".insights-disclosure").nth(2).locator("summary").first().click();
    await page.locator("#insightsRangeSelect").selectOption("90");
    await page.locator("#runCoverageBtn").click(); await page.locator("#coverageStatus").filter({ hasText: /complete/ }).waitFor();
    await page.locator("#runEvaluationBtn").click(); await page.locator("#evaluationStatus").filter({ hasText: /complete/ }).waitFor();
    assert.deepEqual(await storage(page), before);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.equal(await page.evaluate(async () => Boolean(await (await caches.open("fit-roulette-v1.6.3")).match("./manual-slots.js?v=1.6.3"))), true);
    await context.setOffline(true);
    await page.reload({ waitUntil: "load" });
    assert.deepEqual(await storage(page), before);
    await page.locator("[data-screen='closet']").click();
    assert.equal(await page.locator("#closetDensityBtn").getAttribute("aria-pressed"), "false");
    await page.locator("[data-screen='history']").click(); await page.locator("#manualLogHistoryBtn").click();
    await select(page, "top-one"); await select(page, "top-two");
    assert.deepEqual(await selected(page), ["top-two"]);
    await page.locator("#closeManualLogBtn").click(); await page.locator("#discardHistoryExitBtn").click();
    assert.deepEqual(await storage(page), before);
    assert.equal(await page.evaluate(() => window.__locationRequests), 0);
    assert.deepEqual(issues, []); assert.deepEqual(externalRequests, []);
    return { offlineGuardrails: true, seedOnceReloadByteEquivalent: true, densityTransient: true, reviewAndStatusVisible: true, tileFallbacks: true, pendingAnimation: true };
  } finally { await context.close(); }
}

(async () => {
  const { chromium, webkit } = loadPlaywright();
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true });
  try {
    const matrix = [];
    for (const width of [320, 359, 768, 1280]) for (const colorScheme of ["light", "dark"]) {
      matrix.push(await verifyPresentation(browser, url, { width, colorScheme, enlargedText: width < 400 }));
    }
    matrix.push(await verifyPresentation(browser, url, { width: 359, colorScheme: "light", forcedColors: "active", enlargedText: true }));
    const history = await verifyHistoryGuardrails(browser, url);
    const displayAndOffline = await verifyDisplayAndOffline(browser, url);
    const webkitInstalled = fs.existsSync(webkit.executablePath());
    if (webkitInstalled) {
      const safari = await webkit.launch({ headless: true });
      try { for (const width of [320, 359]) for (const colorScheme of ["light", "dark"]) await verifyPresentation(safari, url, { width, colorScheme, enlargedText: true }); }
      finally { await safari.close(); }
    }
    console.log(JSON.stringify({ ok: true, matrix, history, displayAndOffline, webkit: webkitInstalled ? "passed" : "unavailable; physical iPhone Safari and installed-PWA date checks required", personalDataAccessed: false, realLocationAccessed: false }));
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
