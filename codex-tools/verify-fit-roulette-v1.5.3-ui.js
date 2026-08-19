const assert = require("assert");
const fs = require("fs");
const http = require("http");
const path = require("path");

const root = path.resolve(__dirname, "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    return require(path.resolve(path.dirname(process.execPath), "..", "node_modules", "playwright"));
  }
}

function browserExecutable() {
  return [
    process.env.FIT_ROULETTE_BROWSER,
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate)) || "";
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const filePath = path.resolve(root, `.${pathname}`);
      if (!filePath.startsWith(root) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      fs.createReadStream(filePath).pipe(response);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function freshPage(browser, baseUrl, options = {}) {
  const context = await browser.newContext({
    viewport: { width: options.width || 1280, height: 800 },
    colorScheme: options.colorScheme || "light"
  });
  await context.addInitScript(() => { window.__FIT_ROULETTE_TESTING__ = true; });
  const page = await context.newPage();
  const issues = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) issues.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: "load" });
  return { context, page, issues };
}

async function verifyWorkflow(browser, baseUrl) {
  const { context, page, issues } = await freshPage(browser, baseUrl);
  try {
    await page.locator("#quickAddBtn").click();
    assert.equal(await page.locator("#itemDialogTitle").evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.locator("#itemReviewNotice").isHidden(), true);
    assert.equal(await page.locator("#presetSection").isVisible(), true);
    assert.equal(await page.locator("#itemName").getAttribute("placeholder"), 'Example: "Navy Chinos"');

    const order = await page.evaluate(() => [
      "presetSection", "itemName", "itemCategory", "itemSubtype", "sleeveLengthField",
      "itemPrimaryColor", "itemPattern", "secondaryColorField", "itemOccasionFieldset",
      "itemFormality", "weatherLayerSection", "matchingDetails", "advancedDetails"
    ].map((id) => ({ id, top: document.getElementById(id).getBoundingClientRect().top })));
    for (let index = 1; index < order.length; index += 1) {
      assert(order[index].top >= order[index - 1].top, `${order[index].id} is out of visual/DOM order.`);
    }

    const tshirt = page.locator('[data-template-id="t-shirt"]');
    await tshirt.click();
    assert.equal(await tshirt.getAttribute("aria-pressed"), "true");
    assert.equal(await tshirt.evaluate((node) => document.activeElement === node), true);
    assert.equal(await tshirt.locator(".selection-indicator").evaluate((node) => getComputedStyle(node).display), "inline");
    assert.match(await page.locator("#presetStatus").textContent(), /Applied T-Shirt preset/);
    assert.equal(await page.locator("#itemReviewNotice").isHidden(), true);

    await page.locator("#itemFormality").selectOption("3");
    assert.match(await page.locator("#presetStatus").textContent(), /Customized from T-Shirt preset/);
    await tshirt.click();
    assert.match(await page.locator("#presetStatus").textContent(), /Applied T-Shirt preset/);

    const navy = page.locator('[data-color-kind="primary"][data-color="Navy"]');
    await navy.click();
    assert.equal(await navy.getAttribute("aria-pressed"), "true");
    assert.notEqual(await navy.locator(".selection-indicator").evaluate((node) => getComputedStyle(node).display), "none");
    await page.locator("#itemPrimaryColor").selectOption("__custom__");
    assert.equal(await page.locator('[data-color-kind="primary"][aria-pressed="true"]').count(), 0);
    await page.locator("#itemPrimaryColorCustom").fill("Cerulean");

    const casual = page.locator('[data-occasion-preset="casual"]');
    await casual.click();
    assert.equal(await casual.getAttribute("aria-pressed"), "true");
    await page.locator('input[name="itemOccasion"][value="date"]').click();
    assert.equal(await casual.getAttribute("aria-pressed"), "false");

    await page.locator("#itemName").fill("");
    await page.locator("#itemPrimaryColor").selectOption("");
    await page.locator('[data-occasion-preset="clear"]').click();
    const base = page.locator('input[name="itemLayerRole"][value="base"]');
    if (await base.isChecked()) await base.locator("xpath=..").click();
    const beforeInvalidSave = await page.evaluate(() => window.__fitRouletteTest.getState().wardrobe.length);
    await page.locator('#itemForm button[type="submit"]').click();
    assert.equal(await page.locator(".field-error").count(), 4);
    assert.equal(await page.locator('[aria-invalid="true"]').count(), 4);
    assert.equal(await page.locator("#itemName").evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.evaluate(() => window.__fitRouletteTest.getState().wardrobe.length), beforeInvalidSave);
    for (const id of ["itemName", "itemPrimaryColor", "itemOccasionFieldset", "layerRoleFieldset"]) {
      assert.match(await page.locator(`#${id}`).getAttribute("aria-describedby"), /^item-error-/);
    }

    await page.locator("#itemName").fill("Synthetic Navy Tee");
    assert.equal(await page.locator("#itemName").getAttribute("aria-invalid"), null);
    await navy.click();
    await casual.click();
    await base.locator("xpath=..").click();
    assert.equal(await page.locator(".field-error").count(), 0);
    await page.locator('#itemForm button[type="submit"]').click();
    const saved = await page.evaluate(() => window.__fitRouletteTest.getState().wardrobe.find((item) => item.name === "Synthetic Navy Tee"));
    assert(saved);
    assert.equal(saved.review.status, "reviewed");
    assert.deepEqual(saved.review.reasons, []);

    const edit = page.locator('[data-item-id] [data-action="edit"]').first();
    await edit.click();
    assert.equal(await page.locator("#itemDialogTitle").evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.locator("#presetSection").isHidden(), true);
    assert.equal(await page.locator("#matchingDetails").evaluate((node) => node.open), true);
    assert.equal(await page.locator("#preferDetails").evaluate((node) => node.open), false);
    assert.equal(await page.locator("#neverDetails").evaluate((node) => node.open), false);
    await page.evaluate(() => {
      for (const id of ["preferItemsSelect", "neverItemsSelect"]) {
        document.getElementById(id).append(new Option("Synthetic conflict", "synthetic_conflict", true, true));
      }
    });
    await page.locator('#itemForm button[type="submit"]').click();
    assert.equal(await page.locator("#matchingSummary").getAttribute("aria-invalid"), "true");
    assert.match(await page.locator("#matchingSummary").getAttribute("aria-describedby"), /^item-error-/);
    assert.equal(await page.locator("#matchingSummary").evaluate((node) => document.activeElement === node), true);
    for (const id of ["matchingDetails", "preferDetails", "neverDetails"]) {
      assert.equal(await page.locator(`#${id}`).evaluate((node) => node.open), true);
    }
    await page.evaluate(() => {
      for (const id of ["preferItemsSelect", "neverItemsSelect"]) {
        document.querySelector(`#${id} option[value="synthetic_conflict"]`)?.remove();
        document.getElementById(id).dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    assert.equal(await page.locator("#matchingSummary").getAttribute("aria-invalid"), null);
    await page.locator("#closeItemDialogBtn").click();
    assert.equal(await edit.evaluate((node) => document.activeElement === node), true);

    await page.locator('[data-item-id] [data-action="add-similar"]').click();
    assert.equal(await page.locator("#itemDialogTitle").evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.locator("#itemName").evaluate((node) => document.activeElement === node), false);
    assert.equal(await page.locator("#presetSection").isHidden(), true);
    assert.equal(await page.locator("#itemReviewNotice").isHidden(), true);
    await page.locator("#itemName").fill("Synthetic Similar Tee");
    await page.locator("#saveAddSimilarBtn").click();
    assert.equal(await page.locator("#itemDialogTitle").evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.locator("#presetSection").isHidden(), true);
    assert.equal(await page.evaluate(() => window.__fitRouletteTest.getState().wardrobe.length), 2);
    await page.locator("#closeItemDialogBtn").click();

    await page.evaluate(() => {
      const api = window.__fitRouletteTest;
      const Smart = window.FitRouletteSmartCloset;
      const state = api.getState();
      const now = new Date().toISOString();
      state.wardrobe.push(Smart.createItem({
        id: "synthetic_review", name: "Synthetic Migrated Jacket", ...Smart.SUBTYPE_TEMPLATES.jacket,
        primaryColor: "Olive", review: { status: "needs_review", reasons: ["Confirm migrated protection."], reviewedAt: "" },
        legacyFallback: true, legacyMatching: { worksWithTags: ["navy"] }, createdAt: now, updatedAt: now
      }, { now }));
      api.replaceState(state);
    });
    await page.locator('[data-review-id="synthetic_review"]').click();
    assert.equal(await page.locator("#itemReviewNotice").isVisible(), true);
    assert.match(await page.locator("#itemReviewNotice").textContent(), /Confirm migrated protection/);
    assert.equal(await page.locator("#advancedDetails").evaluate((node) => node.open), true);
    assert.equal(await page.locator("#presetSection").isHidden(), true);
    await page.locator('#itemForm button[type="submit"]').click();
    const reviewed = await page.evaluate(() => window.__fitRouletteTest.getState().wardrobe.find((item) => item.id === "synthetic_review"));
    assert.equal(reviewed.review.status, "reviewed");
    assert.equal(reviewed.legacyFallback, false);

    const addItem = page.locator("#addItemBtn");
    await addItem.click();
    assert.equal(await page.locator('[data-template-id][aria-pressed="true"]').count(), 0);
    assert.equal(await page.locator("#presetStatus").isHidden(), true);
    await page.locator("#closeItemDialogBtn").click();
    assert.equal(await addItem.evaluate((node) => document.activeElement === node), true);

    assert.deepEqual(issues, []);
    return { validationIssues: 4, savedItems: 3, genuineReviewPreservedUntilSave: true };
  } finally {
    await context.close();
  }
}

async function verifyWeatherCommunication(browser, baseUrl) {
  const { context, page, issues } = await freshPage(browser, baseUrl, { width: 359 });
  try {
    const report = await page.evaluate(() => {
      const api = window.__fitRouletteTest;
      const Smart = window.FitRouletteSmartCloset;
      const Context = window.FitRouletteContextEngine;
      const now = new Date().toISOString();
      const cached = Context.normalizeProviderResponse({ current: {
        temperature_2m: 12, apparent_temperature: 10, precipitation: 0, rain: 0, showers: 0,
        snowfall: 0, weather_code: 2, wind_speed_10m: 12, is_day: 1, time: "2026-08-12T12:00"
      } }, { fetchedAt: now });
      const state = Smart.createFreshState(now);
      state.setup = { completed: true, choice: "synthetic" };
      const labels = () => ({
        preference: document.querySelector("#weatherPreferenceStatus").textContent,
        availability: document.querySelector("#weatherAvailabilityStatus").textContent,
        effective: document.querySelector("#weatherEffectiveStatus").textContent
      });
      const snapshots = {};
      api.replaceState(state);
      snapshots.off = labels();
      api.replaceState({ ...state, settings: { ...state.settings, weather: { automatic: true, unit: "f", cached, legacyManual: null } } });
      snapshots.cached = labels();
      api.setContextSession({ mode: "manual", manualTemperatureC: 18, manualCondition: "cloudy", ignore: false });
      snapshots.manual = labels();
      api.setContextSession({ mode: "automatic", ignore: true });
      snapshots.ignored = labels();
      const stale = { ...cached, fetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() };
      api.replaceState({ ...state, settings: { ...state.settings, weather: { automatic: true, unit: "f", cached: stale, legacyManual: null } } });
      api.setContextSession({ mode: "automatic", acceptStale: true, ignore: false });
      snapshots.stale = labels();
      api.replaceState({ ...state, settings: { ...state.settings, weather: { automatic: true, unit: "f", cached: null, legacyManual: null } } });
      snapshots.unavailable = labels();
      api.setCurrentOutfit({ occasion: "casual", items: [], context: api.currentEffectiveContext() });
      api.renderResult();
      snapshots.after = labels();
      return { snapshots, persisted: JSON.stringify(api.getState()) };
    });
    assert.match(report.snapshots.off.preference, /Off/);
    assert.match(report.snapshots.off.availability, /Not enabled/);
    assert.match(report.snapshots.cached.preference, /On/);
    assert.match(report.snapshots.cached.availability, /Cached/);
    assert.match(report.snapshots.manual.effective, /Manual context/);
    assert.match(report.snapshots.ignored.effective, /Ignored/);
    assert.match(report.snapshots.stale.availability, /Stale/);
    assert.match(report.snapshots.stale.effective, /Accepted stale/);
    assert.match(report.snapshots.unavailable.preference, /On/);
    assert.match(report.snapshots.unavailable.availability, /Unavailable/);
    assert.match(report.snapshots.after.effective, /This outfit used: Neutral context/);
    assert(!/latitude|longitude|accuracy|coordinates|providerurl|weatherurl/i.test(report.persisted));
    assert.deepEqual(issues, []);
    return report.snapshots;
  } finally {
    await context.close();
  }
}

async function verifySelectedContrast(browser, baseUrl, colorScheme) {
  const { context, page, issues } = await freshPage(browser, baseUrl, { width: 359, colorScheme });
  try {
    await page.locator("#quickAddBtn").click();
    const button = page.locator('[data-template-id="t-shirt"]');
    await button.click();
    const contrast = await button.evaluate((node) => {
      const parse = (value) => {
        const values = value.match(/[\d.]+/g).slice(0, 3).map(Number);
        return value.startsWith("color(srgb") ? values.map((channel) => channel * 255) : values;
      };
      const luminance = (rgb) => {
        const values = rgb.map((value) => {
          const channel = value / 255;
          return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const style = getComputedStyle(node);
      const first = luminance(parse(style.color));
      const second = luminance(parse(style.backgroundColor));
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    });
    assert(contrast >= 4.5, `${colorScheme} selected preset contrast was ${contrast}.`);
    assert.deepEqual(issues, []);
    return Math.round(contrast * 100) / 100;
  } finally {
    await context.close();
  }
}

async function verifyDailyWorkflowFixes(browser, baseUrl, width, colorScheme) {
  const { context, page, issues } = await freshPage(browser, baseUrl, { width, colorScheme });
  try {
    const unavailableName = await page.evaluate(() => {
      const api = window.__fitRouletteTest;
      const Smart = window.FitRouletteSmartCloset;
      const now = new Date().toISOString();
      const state = Smart.createFreshState(now);
      state.setup = { completed: true, choice: "existing" };
      state.wardrobe = api.sampleWardrobe();
      state.wardrobe[0].status = "unavailable";
      api.replaceState(state);
      return state.wardrobe[0].name;
    });
    if (width === 320) await page.evaluate(() => { document.documentElement.style.fontSize = "20px"; });

    const quickAdd = page.locator("#quickAddBtn");
    await quickAdd.click();
    assert.equal(await page.locator("#itemDialogTitle").evaluate((node) => document.activeElement === node), true);
    assert.equal(await page.locator("#itemName").evaluate((node) => document.activeElement === node), false);
    assert.equal(await page.locator("#itemDialog").evaluate((node) => node.classList.contains("keyboard-open")), false);
    assert.equal(await page.locator("#itemDialogTitle").evaluate((node) => getComputedStyle(node).outlineStyle), "none");

    assert.equal(await page.locator('[data-color-kind="primary"]').count(), 22);
    assert.equal(await page.locator('[data-color-kind="secondary"]').count(), 22);
    assert.equal(await page.locator(".color-swatch").count(), 44);
    await page.locator("#itemPattern").selectOption("striped");
    assert.equal(await page.locator("#secondaryColorChips").isVisible(), true);
    await page.locator('[data-color-kind="primary"][data-color="Navy"]').click();
    await page.locator('[data-color-kind="secondary"][data-color="White"]').click();
    assert.equal(await page.locator("#itemPrimaryColor").inputValue(), "Navy");
    assert.equal(await page.locator("#itemSecondaryColor").inputValue(), "White");
    assert.equal(await page.locator('[data-color-kind="primary"][data-color="Navy"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-color-kind="secondary"][data-color="White"]').getAttribute("aria-pressed"), "true");
    assert.notEqual(
      await page.locator(".color-swatch-navy").first().evaluate((node) => { const style = getComputedStyle(node); return style.backgroundImage === "none" ? style.backgroundColor : style.backgroundImage; }),
      await page.locator(".color-swatch-white").first().evaluate((node) => { const style = getComputedStyle(node); return style.backgroundImage === "none" ? style.backgroundColor : style.backgroundImage; })
    );
    await page.locator("#itemPattern").selectOption("solid");
    assert.equal(await page.locator("#secondaryColorChips").isHidden(), true);
    assert.equal(await page.locator("#itemSecondaryColor").isDisabled(), true);
    await page.locator("#closeItemDialogBtn").click();
    if (await page.locator("#itemExitDialog").isVisible()) await page.locator("#discardItemExitBtn").click();

    await quickAdd.focus();
    await quickAdd.press("Enter");
    assert.equal(await page.locator("#itemDialog").evaluate((node) => node.classList.contains("keyboard-open")), true);
    assert.equal(await page.locator("#itemDialogTitle").evaluate((node) => getComputedStyle(node).outlineStyle), "solid");
    await page.locator("#closeItemDialogBtn").click();
    assert.equal(await quickAdd.evaluate((node) => document.activeElement === node), true);

    await page.locator('[data-screen="closet"]').click();
    const sourceCard = page.locator("[data-item-id]").first();
    const sourceName = (await sourceCard.locator("h3").textContent()).trim();
    const beforeDuplicate = await page.evaluate(() => window.__fitRouletteTest.getState().wardrobe.length);
    await sourceCard.locator('[data-action="add-similar"]').click();
    await page.locator("#itemName").fill(`  ${sourceName.toUpperCase()}  `);
    await page.locator('#itemForm button[type="submit"]').click();
    assert.equal(await page.locator("#duplicateDialog").isVisible(), true);
    await page.locator("#reviewDuplicateBtn").click();
    assert.equal(await page.locator("#duplicateReviewDetails").isVisible(), true);
    await page.locator("#continueDuplicateEditingBtn").click();
    assert.equal((await page.locator("#itemName").inputValue()).trim(), sourceName.toUpperCase());
    await page.locator('#itemForm button[type="submit"]').click();
    await page.locator("#saveDuplicateAnywayBtn").click();
    assert.equal(await page.evaluate(() => window.__fitRouletteTest.getState().wardrobe.length), beforeDuplicate + 1);

    await page.locator('[data-screen="generate"]').click();
    await page.locator("#manualLogGenerateBtn").click();
    assert.match(await page.locator("#manualSelectedCount").textContent(), /^0 garments/);
    await page.locator("#manualItemSearch").fill("navy");
    const navyChoice = page.locator('input[name="manualItem"]').first();
    const navyId = await navyChoice.getAttribute("value");
    await navyChoice.check();
    assert.match(await page.locator("#manualSelectedCount").textContent(), /^1 garment/);
    await page.locator("#manualItemSearch").fill("no synthetic match token");
    assert.equal(await page.locator('input[name="manualItem"]').count(), 0);
    assert.equal(await page.locator(`[data-remove-manual-item="${navyId}"]`).count(), 1, "Selected garments must stay discoverable while filtered out.");
    await page.locator("#manualItemSearch").fill("");
    assert.equal(await page.locator(`input[name="manualItem"][value="${navyId}"]`).isChecked(), true);
    const remaining = page.locator('input[name="manualItem"]:not(:checked)');
    for (let index = 0; index < 5; index += 1) await remaining.nth(index).check();
    assert.match(await page.locator("#manualSelectedCount").textContent(), /^6 garments/);
    await page.locator("#manualIncludeUnavailable").check();
    await page.locator("#manualItemSearch").fill(unavailableName);
    await page.locator('input[name="manualItem"]').check();
    assert.match(await page.locator("#manualSelectedCount").textContent(), /^7 garments/);
    await page.locator("#manualIncludeUnavailable").uncheck();
    assert.match(await page.locator("#manualSelectedCount").textContent(), /^6 garments/, "Disabling unavailable items must remove only newly ineligible selections.");
    await page.locator("#manualItemSearch").fill("");
    await page.locator('#manualLogForm button[type="submit"]').click();
    const logged = await page.evaluate(() => window.__fitRouletteTest.getState().history[0]);
    assert.equal(logged.source, "manual");
    assert.equal(logged.itemIds.length, 6);
    assert.equal(new Set(logged.itemIds).size, 6);

    const overflow = await page.evaluate(() => ({ html: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.body.clientWidth }));
    assert(overflow.html <= 1 && overflow.body <= 1, `${width}px daily workflow overflowed: ${JSON.stringify(overflow)}`);
    assert.deepEqual(issues, []);
    return { width, colorScheme, enlargedText: width === 320, canonicalColors: 22, manualItemsLogged: 6, horizontalOverflow: 0 };
  } finally {
    await context.close();
  }
}

(async () => {
  const { chromium } = loadPlaywright();
  const executablePath = browserExecutable();
  assert(executablePath, "No Chromium browser was found.");
  const server = await serve();
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/?v153-ui=1`;
    const workflow = await verifyWorkflow(browser, baseUrl);
    const weather = await verifyWeatherCommunication(browser, baseUrl);
    const contrast = {
      light: await verifySelectedContrast(browser, baseUrl, "light"),
      dark: await verifySelectedContrast(browser, baseUrl, "dark")
    };
    const dailyWorkflow = [];
    for (const width of [320, 359, 1280]) {
      for (const colorScheme of ["light", "dark"]) dailyWorkflow.push(await verifyDailyWorkflowFixes(browser, baseUrl, width, colorScheme));
    }
    console.log(JSON.stringify({ ok: true, workflow, weatherStates: Object.keys(weather), selectedContrast: contrast, dailyWorkflow }));
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
